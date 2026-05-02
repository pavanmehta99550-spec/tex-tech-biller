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
    let detailedStatus: string = 'Initializing...';

    let isReconnecting = false;

    async function connectToWhatsApp() {
        if (isReconnecting) {
            console.log('WhatsApp: Already connecting/reconnecting, skipping...');
            return;
        }

        console.log('WhatsApp: Starting connection process...');
        detailedStatus = 'Starting connection...';
        
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
                console.log('WhatsApp: Fetching latest version...');
                // Set a timeout for version fetching to prevent hangs
                const versionPromise = fetchLatestBaileysVersion();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Version fetch timeout')), 10000)
                );
                
                const latest: any = await Promise.race([versionPromise, timeoutPromise]);
                version = latest.version;
                console.log(`WhatsApp: Using latest WA v${version.join('.')}`);
            } catch (err) {
                console.error('WhatsApp: Failed to fetch latest version, using fallback:', err);
                version = [2, 3000, 1017531287]; 
            }

            detailedStatus = 'Loading auth state...';
            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            detailedStatus = 'Initializing socket...';
            const currentSock = makeWASocket({
                version,
                logger,
                auth: {
                    creds: state.creds,
                    keys: state.keys,
                },
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                qrTimeout: 60000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                markOnlineOnConnect: true,
                retryRequestDelayMs: 5000,
            });

            sock = currentSock;
            detailedStatus = 'Waiting for connection update...';

            currentSock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    qrCode = await QRCode.toDataURL(qr);
                    detailedStatus = 'Scan QR code to link';
                    console.log('WhatsApp: New QR code generated');
                } catch (err) {
                    console.error('WhatsApp: Failed to generate QR data URL:', err);
                }
            }

            if (connection === 'close') {
                if (sock !== currentSock) {
                    console.log('WhatsApp: Ignoring close event for non-current socket');
                    return;
                }

                const error = lastDisconnect?.error as Boom;
                const statusCode = error?.output?.statusCode;
                
                // Detailed handling of disconnect reasons
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                      statusCode !== DisconnectReason.badSession;
                
                console.log(`WhatsApp: Connection closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}, Error: ${error?.message}`);
                
                connectionStatus = 'disconnected';
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
                    detailedStatus = statusCode === DisconnectReason.loggedOut ? 'Logged out' : 'Bad session';
                    console.log('WhatsApp: Clearing auth due to logout or bad session...');
                    const authPath = '/tmp/wa_auth';
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                    qrCode = null;
                    isReconnecting = true;
                    setTimeout(() => {
                        isReconnecting = false;
                        connectToWhatsApp();
                    }, 5000);
                } else if (shouldReconnect) {
                    detailedStatus = 'Reconnecting...';
                    isReconnecting = true;
                    // For 428 (Connection Terminated), use a slightly longer delay
                    const delay = statusCode === 428 ? 10000 : 5000;
                    setTimeout(() => {
                        isReconnecting = false;
                        connectToWhatsApp();
                    }, delay);
                } else {
                    detailedStatus = `Disconnected (${statusCode || 'Unknown'})`;
                    qrCode = null;
                }
            } else if (connection === 'open') {
                if (sock !== currentSock) return;
                console.log('WhatsApp: Connection opened successfully');
                connectionStatus = 'connected';
                detailedStatus = 'Authenticated & Ready';
                qrCode = null;
                isReconnecting = false;
            }
        });

        currentSock.ev.on('creds.update', saveCreds);
        } catch (e) {
            console.error('WhatsApp: Fatal connection error:', e);
            detailedStatus = 'Connection error: ' + (e as Error).message;
            isReconnecting = false;
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
            if (sock) {
                try {
                    await sock.logout();
                } catch (e) {
                    console.error('Logout error:', e);
                }
            }
            
            const authPath = '/tmp/wa_auth';
            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
            }
            
            qrCode = null;
            connectionStatus = 'disconnected';
            
            res.json({ success: true });
            
            // Re-initialize to show fresh QR
            setTimeout(connectToWhatsApp, 2000);
        } catch (error) {
            console.error('Logout handler error:', error);
            res.status(500).json({ error: String(error) });
        }
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
        // Connect to WhatsApp after server has started to avoid blocking startup
        setTimeout(() => {
            connectToWhatsApp().catch(err => {
                console.error('WhatsApp: Initial connection failure:', err);
            });
        }, 3000); // Wait 3s after boot
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
