import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: 'info' });

async function startServer() {
    const app = express();
    const PORT = 3000;

    // Health check
    app.get('/health', (req, res) => res.send('OK'));

    app.use(express.json({ limit: '50mb' }));

    let sock: any = null;
    let qrCode: string | null = null;
    let connectionStatus: string = 'disconnected';
    let detailedStatus: string = 'Idle';

    let isInitializing = false;

    async function connectToWhatsApp() {
        if (isInitializing) {
            console.log('WhatsApp: Already initializing, skipping...');
            return;
        }

        isInitializing = true;
        console.log('WhatsApp: Starting connection process...');
        detailedStatus = 'Connecting...';
        
        try {
            // Cleanup existing socket if any
            if (sock) {
                console.log('WhatsApp: Cleaning up existing socket...');
                try {
                    sock.ev.removeAllListeners();
                    if (typeof sock.end === 'function') {
                        sock.end(undefined);
                    }
                } catch (e) {
                    console.error('WhatsApp: Error during socket cleanup:', e);
                }
                sock = null;
            }

            qrCode = null;
            const authPath = '/tmp/wa_auth';
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            let version;
            try {
                const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
                version = latestVersion;
                console.log(`WhatsApp: Using WA version v${version.join('.')} (latest: ${isLatest})`);
            } catch (err) {
                console.error('WhatsApp: Version fetch failed, using fallback:', err);
                version = [2, 3000, 1017531287]; 
            }

            detailedStatus = 'Loading Account...';
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            detailedStatus = 'Opening Session...';
            const currentSock = makeWASocket({
                version,
                logger,
                auth: {
                    creds: state.creds,
                    keys: state.keys,
                },
                printQRInTerminal: false,
                browser: ["Desktop", "Chrome", "124.0.0.0"],
                syncFullHistory: false,
                qrTimeout: 60000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                markOnlineOnConnect: true,
                retryRequestDelayMs: 5000,
            });

            sock = currentSock;
            detailedStatus = 'Authenticating...';

            currentSock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    try {
                        qrCode = await QRCode.toDataURL(qr);
                        detailedStatus = 'Scan QR code';
                        console.log('WhatsApp: New QR code generated');
                    } catch (err) {
                        console.error('WhatsApp: Failed to generate QR:', err);
                    }
                }

                if (connection === 'close') {
                    isInitializing = false;
                    if (sock !== currentSock) {
                        console.log('WhatsApp: Ignoring close for old socket');
                        return;
                    }

                    const error = lastDisconnect?.error as Boom;
                    const statusCode = error?.output?.statusCode;
                    
                    // Detailed handling of disconnect reasons
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                          statusCode !== DisconnectReason.badSession;
                    
                    console.log(`WhatsApp: Connection closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}, Msg: ${error?.message}`);
                    
                    connectionStatus = 'disconnected';
                    
                    if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
                        detailedStatus = 'Session Ended';
                        const authPath = '/tmp/wa_auth';
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true });
                        }
                        qrCode = null;
                        setTimeout(() => connectToWhatsApp(), 3000);
                    } else if (shouldReconnect) {
                        detailedStatus = statusCode === 428 ? 'Server Rejected' : 'Reconnecting...';
                        // For 428 (Connection Terminated), use a much longer delay to allow server cooling
                        const delay = statusCode === 428 ? 30000 : 5000;
                        setTimeout(() => connectToWhatsApp(), delay);
                    } else {
                        detailedStatus = `Error ${statusCode || 'Unknown'}`;
                        qrCode = null;
                    }
                } else if (connection === 'open') {
                    isInitializing = false;
                    if (sock !== currentSock) return;
                    console.log('WhatsApp: Connection opened successfully');
                    connectionStatus = 'connected';
                    detailedStatus = 'Active';
                    qrCode = null;
                }
            });

            currentSock.ev.on('creds.update', saveCreds);
        } catch (e) {
            isInitializing = false;
            console.error('WhatsApp: Fatal connection error:', e);
            detailedStatus = 'Connection Error';
        }
    }

    // API Routes
    app.get('/api/whatsapp/status', (req, res) => {
        console.log('API: GET /whatsapp/status');
        res.json({ 
            status: connectionStatus, 
            detailedStatus, 
            hasQr: !!qrCode,
            qr: qrCode 
        });
    });

    app.get('/api/whatsapp/qr', (req, res) => {
        if (qrCode) {
            res.json({ qr: qrCode });
        } else {
            res.status(404).json({ error: 'QR not available' });
        }
    });

    app.post('/api/whatsapp/logout', async (req, res) => {
        try {
            console.log('API: POST /whatsapp/logout');
            if (sock) {
                try {
                    await sock.logout();
                } catch (e) {
                    console.error('Logout error:', e);
                }
                sock = null;
            }
            
            const authPath = '/tmp/wa_auth';
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            
            qrCode = null;
            connectionStatus = 'disconnected';
            detailedStatus = 'Logged Out';
            isInitializing = false;
            
            res.json({ success: true });
            
            // Re-initialize to show fresh QR
            setTimeout(connectToWhatsApp, 2000);
        } catch (error) {
            console.error('Logout handler error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    app.post('/api/whatsapp/restart', (req, res) => {
        console.log('API: POST /whatsapp/restart');
        isInitializing = false;
        qrCode = null;
        if (sock) {
            try {
                sock.ev.removeAllListeners('connection.update');
                sock.end(undefined);
            } catch (e) {}
            sock = null;
        }
        connectToWhatsApp();
        res.json({ success: true });
    });

    app.post('/api/whatsapp/send-bill', async (req, res) => {
        const { phone, billNumber, pdfBase64, partyName } = req.body;

        if (!phone || !pdfBase64) {
            return res.status(400).json({ error: 'Phone and PDF are required' });
        }

        if (connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp is not connected' });
        }

        try {
            // Clean phone number: remove non-digits, add country code if missing (Indian default)
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length === 10) {
                cleanPhone = '91' + cleanPhone;
            }
            const jid = `${cleanPhone}@s.whatsapp.net`;

            // Prepare PDF buffer
            const buffer = Buffer.from(pdfBase64.split(',')[1], 'base64');

            await sock.sendMessage(jid, {
                document: buffer,
                fileName: `Bill_${billNumber || 'Invoice'}.pdf`,
                mimetype: 'application/pdf',
                caption: `Hello ${partyName || 'Customer'},\n\nAttached is your Bill #${billNumber || ''}.\n\nThank you for your business! 🙏`
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Failed to send WhatsApp message:', error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // Vite integration
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa'
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT}`);
        // Connect to WhatsApp after server has started
        setTimeout(() => {
            connectToWhatsApp().catch(err => {
                console.error('WhatsApp: Initial connection failure:', err);
            });
        }, 5000); // Wait 5s after boot
    });

    // Handle process errors to prevent total crash
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
}

startServer();
