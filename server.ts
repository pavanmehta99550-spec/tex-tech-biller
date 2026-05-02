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

    app.use(express.json({ limit: '50mb' }));

    let sock: any = null;
    let qrCode: string | null = null;
    let connectionStatus: string = 'disconnected';
    let detailedStatus: string = 'Initializing...';

    async function connectToWhatsApp() {
        // Cleanup existing socket if any
        if (sock) {
            console.log('Cleaning up existing WhatsApp socket...');
            try {
                sock.ev.removeAllListeners();
                sock.terminate();
            } catch (e) {
                console.error('Error during socket cleanup:', e);
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
            const latest = await fetchLatestBaileysVersion();
            version = latest.version;
            console.log(`using latest WA v${version.join('.')}`);
        } catch (err) {
            console.error('Failed to fetch latest Baileys version, using fallback:', err);
            version = [2, 3000, 1017531287]; 
        }

        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        detailedStatus = 'Connecting to WhatsApp...';

        sock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
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

        sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    qrCode = await QRCode.toDataURL(qr);
                    detailedStatus = 'Scan QR code to link';
                    console.log('New QR code generated');
                } catch (err) {
                    console.error('Failed to generate QR data URL:', err);
                }
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`Connection closed. Reason: ${statusCode}, Reconnecting: ${shouldReconnect}`);
                
                connectionStatus = 'disconnected';
                detailedStatus = statusCode === DisconnectReason.loggedOut 
                    ? 'Logged out' 
                    : `Disconnected (${statusCode || 'Server Terminated'})`;
                qrCode = null;

                if (shouldReconnect) {
                    detailedStatus = 'Reconnecting...';
                    const delay = statusCode === DisconnectReason.connectionLost ? 2000 : 5000;
                    setTimeout(connectToWhatsApp, delay); 
                } else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Logged out from phone. Clearing auth and restarting...');
                    const authPath = '/tmp/wa_auth';
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                    setTimeout(connectToWhatsApp, 2000);
                }
            } else if (connection === 'open') {
                console.log('WhatsApp connection opened successfully');
                connectionStatus = 'connected';
                detailedStatus = 'Authenticated & Ready';
                qrCode = null;
            }
        });

        sock.ev.on('creds.update', saveCreds);
    }

    connectToWhatsApp();

    // API Routes
    app.get('/api/whatsapp/status', (req, res) => {
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
    });
}

startServer();
