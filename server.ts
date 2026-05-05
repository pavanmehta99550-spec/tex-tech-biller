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

// Global Anti-Crash Handlers
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const logger = pino({ level: 'info' });

async function startServer() {
    console.log('App: Starting server initialization...');
    const app = express();
    const PORT = 3000;

    // Health check
    app.get('/health', (req, res) => res.send('OK'));

    app.use(express.json({ limit: '50mb' }));

    let sock: any = null;
    let qrCode: string | null = null;
    let connectionStatus: string = 'disconnected';
    let detailedStatus: string = 'Idle';
    let failureCount = 0;
    let backoffDelay = 5000;

    let isInitializing = false;
    let initWatchdog: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    // Multi-client status broadcasting
    const clients = new Set<express.Response>();
    const broadcastStatus = () => {
        const data = JSON.stringify({ 
            status: connectionStatus, 
            detailedStatus, 
            hasQr: !!qrCode,
            qr: qrCode 
        });
        clients.forEach(client => {
            try {
                client.write(`data: ${data}\n\n`);
            } catch (e) {
                clients.delete(client);
            }
        });
    };

    // Keep SSE connections alive
    setInterval(() => {
        clients.forEach(client => {
            try {
                client.write(': heartbeat\n\n');
            } catch (e) {
                clients.delete(client);
            }
        });
    }, 25000);

    // Update status and broadcast
    const setStatus = (status: string, detailed: string = '') => {
        console.log(`WhatsApp Status Change: ${status} | ${detailed}`);
        connectionStatus = status;
        detailedStatus = detailed;
        broadcastStatus();
    };

    async function connectToWhatsApp() {
        if (isInitializing) {
            console.log('WhatsApp: Initialization already in progress, skipping duplicate call.');
            broadcastStatus();
            return;
        }

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        isInitializing = true;
        console.log(`WhatsApp: Starting connection sequence (Retry/Failure Count: ${failureCount})...`);
        setStatus('disconnected', 'Initialising...');

        if (initWatchdog) clearTimeout(initWatchdog);
        initWatchdog = setTimeout(() => {
            if (isInitializing && connectionStatus !== 'connected') {
                console.warn('WhatsApp: Initialization watchdog triggered after 2 minutes. Resetting state.');
                isInitializing = false;
                setStatus('disconnected', 'Timeout: Resetting...');
                connectToWhatsApp();
            }
        }, 120000); 
        
        try {
            if (sock) {
                console.log('WhatsApp: Closing existing socket listeners...');
                try {
                    sock.ev.removeAllListeners();
                    sock.end(undefined);
                } catch (e) {
                    console.log('WhatsApp: Error ending old socket:', e);
                }
                sock = null;
            }

            qrCode = null;
            const authPath = path.join(process.cwd(), 'wa_auth');
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            console.log('WhatsApp: Loading auth state from:', authPath);
            let state, saveCreds;
            try {
                const authState = await useMultiFileAuthState(authPath);
                state = authState.state;
                saveCreds = authState.saveCreds;
            } catch (err) {
                console.error('WhatsApp: Auth state loading failed, clearing corrupted data.');
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                isInitializing = false;
                setTimeout(() => connectToWhatsApp(), 2000);
                return;
            }
            
            state.keys = makeCacheableSignalKeyStore(state.keys, logger);

            setStatus('disconnected', 'Connecting...');
            
            let version;
            try {
                console.log('WhatsApp: Fetching latest version...');
                const versionResult: any = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1017531301] }));
                version = versionResult.version;
                console.log(`WhatsApp: Using version v${version.join('.')}`);
            } catch (err) {
                version = [2, 3000, 1017531301];
            }

            const currentSock = makeWASocket({
                version,
                logger,
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.macOS('Desktop'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                qrTimeout: 40000, // Slightly shorter timeout for faster cycling
                connectTimeoutMs: 60000, 
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 15000, 
                markOnlineOnConnect: true,
                retryRequestDelayMs: 5000,
                generateHighQualityLinkPreview: false,
                linkPreviewImageThumbnailWidth: 192,
                shouldIgnoreJid: (jid) => jid.includes('@broadcast'),
            });

            sock = currentSock;

            currentSock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    try {
                        qrCode = await QRCode.toDataURL(qr);
                        console.log('WhatsApp: New QR code generated successfully');
                        setStatus('disconnected', 'Scan QR Code');
                    } catch (err) {
                        console.error('WhatsApp: QR Generation failed:', err);
                        setStatus('disconnected', 'QR Error');
                    }
                    isInitializing = false; 
                    failureCount = 0;
                    if (initWatchdog) { clearTimeout(initWatchdog); initWatchdog = null; }
                }

                if (connection === 'close') {
                    isInitializing = false;
                    qrCode = null;
                    if (initWatchdog) { clearTimeout(initWatchdog); initWatchdog = null; }

                    if (sock !== currentSock) {
                        console.log('WhatsApp: Closing stale connection, ignoring.');
                        return;
                    }

                    const error = lastDisconnect?.error as Boom;
                    const statusCode = error?.output?.statusCode;
                    const errorMsg = error?.message || error?.stack || 'Unknown Close Reason';
                    
                    console.error(`WhatsApp: Connection Closed. Status: ${statusCode}. Error: ${errorMsg}`);
                    
                    const isTerminated = statusCode === 428 || statusCode === 515 || statusCode === 503 || statusCode === 440 ||
                                       errorMsg.toLowerCase().includes('terminated') || 
                                       errorMsg.includes('hangup') ||
                                       errorMsg.includes('Handshake timeout');

                    if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession || (isTerminated && failureCount >= 3)) {
                        console.warn('WhatsApp: Terminal dissociation. Purging auth data.');
                        if (fs.existsSync(authPath)) {
                            try { fs.rmSync(authPath, { recursive: true, force: true }); } catch(e) {}
                        }
                        setStatus('disconnected', 'Resetting Session...');
                        failureCount = 0;
                        reconnectTimer = setTimeout(() => connectToWhatsApp(), 5000); 
                    } else {
                        failureCount++;
                        const delay = Math.min(5000 * failureCount, 30000);
                        console.log(`WhatsApp: Reconnecting in ${delay/1000}s...`);
                        setStatus('disconnected', 'Offline: Reconnecting...');
                        reconnectTimer = setTimeout(() => connectToWhatsApp(), delay);
                    }
                } else if (connection === 'open') {
                    console.log('WhatsApp: Connection established successfully!');
                    isInitializing = false;
                    failureCount = 0;
                    qrCode = null;
                    if (initWatchdog) { clearTimeout(initWatchdog); initWatchdog = null; }
                    if (sock === currentSock) {
                        setStatus('connected', 'Connected');
                    }
                }
            });

            currentSock.ev.on('creds.update', saveCreds);
        } catch (e) {
            console.error('WhatsApp: Connection attempt failed catastrophically:', e);
            isInitializing = false;
            failureCount++;
            if (initWatchdog) { clearTimeout(initWatchdog); initWatchdog = null; }
            setStatus('disconnected', 'Crash: Retry in 10s');
            reconnectTimer = setTimeout(() => connectToWhatsApp(), 10000);
        }
    }

    // API Routes
    app.get('/api/whatsapp/sse', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const sendData = (data: any) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send current state immediately
        sendData({ 
            status: connectionStatus, 
            detailedStatus, 
            hasQr: !!qrCode,
            qr: qrCode 
        });

        // Auto-start if idle
        if (detailedStatus === 'Idle' && !isInitializing) {
            console.log('App: Client connected and WhatsApp is Idle. Starting connection...');
            connectToWhatsApp();
        }

        // Add to broadcast group
        const clientWriter = {
            write: (msg: string) => res.write(msg)
        } as express.Response;
        
        clients.add(clientWriter);

        req.on('close', () => {
            clients.delete(clientWriter);
        });
    });

    app.get('/api/whatsapp/status', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
            
            const authPath = path.join(process.cwd(), 'wa_auth');
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

    const distPath = path.join(process.cwd(), 'dist');
    const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);
    
    console.log(`App: Environment: ${process.env.NODE_ENV || 'development'}. Using Prod Mode: ${isProd}`);
    
    if (!isProd) {
        console.log('App: Initializing Vite dev server...');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa'
        });
        app.use(vite.middlewares);
    } else {
        console.log('App: Serving static files from dist/');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    console.log('App: Setting up Vite and starting listener...');
    connectToWhatsApp(); // Initialize WhatsApp on startup
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error('CRITICAL: Server failed to start:', err);
    process.exit(1);
});
