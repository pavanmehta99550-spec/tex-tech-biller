import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
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

    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            logger,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false, // We want to show it in the UI
        });

        sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCode = await QRCode.toDataURL(qr);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                connectionStatus = 'disconnected';
                qrCode = null;
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('opened connection');
                connectionStatus = 'connected';
                qrCode = null;
            }
        });

        sock.ev.on('creds.update', saveCreds);
    }

    connectToWhatsApp();

    // API Routes
    app.get('/api/whatsapp/status', (req, res) => {
        res.json({ status: connectionStatus, hasQr: !!qrCode });
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
                await sock.logout();
                // Optionally delete auth_info folder
                if (fs.existsSync('auth_info')) {
                    fs.rmSync('auth_info', { recursive: true, force: true });
                }
                res.json({ success: true });
                connectToWhatsApp(); // Restart to get new QR
            } else {
                res.status(400).json({ error: 'No active session' });
            }
        } catch (error) {
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
