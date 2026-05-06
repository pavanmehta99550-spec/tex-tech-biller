import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import makeWASocket, { 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    initAuthCreds,
    BufferJSON,
    AuthenticationState,
    WAProto
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAylk4kI5has8jdwX0ef29vcRkLPoSoNw",
  authDomain: "clipnova-f259d.firebaseapp.com",
  projectId: "clipnova-f259d",
  storageBucket: "clipnova-f259d.firebasestorage.app",
  messagingSenderId: "1021594403404",
  appId: "1:1021594403404:web:19507943ef63890047aae9",
  measurementId: "G-K6SWPH27MP"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export const useFirestoreAuthState = async (collectionName: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
    const writeData = async (data: any, id: string) => {
        try {
            const parsedData = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
            await setDoc(doc(db, collectionName, id), parsedData);
        } catch (error) {
            console.error('Error writing auth state to Firestore:', error);
        }
    };

    const readData = async (id: string) => {
        try {
            const docSnap = await getDoc(doc(db, collectionName, id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Error reading auth state from Firestore:', error);
        }
        return null;
    };

    const removeData = async (id: string) => {
        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (error) {
            console.error('Error removing auth state from Firestore:', error);
        }
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data: { [key: string]: any } = {};
                    await Promise.all(ids.map(async id => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = WAProto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category as keyof typeof data]) {
                            const value = data[category as keyof typeof data][id];
                            const fileId = `${category}-${id}`;
                            tasks.push(value ? writeData(value, fileId) : removeData(fileId));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds');
        }
    };
};

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
            console.log('WhatsApp: Loading auth state from Firestore database...');
            let state, saveCreds;
            try {
                const authState = await useFirestoreAuthState('wa_auth_bot1'); // using a unique collection name for the session
                state = authState.state;
                saveCreds = authState.saveCreds;
            } catch (err) {
                console.error('WhatsApp: Auth state loading from Firestore failed:', err);
                isInitializing = false;
                setTimeout(() => connectToWhatsApp(), 2000);
                return;
            }
            
            state.keys = makeCacheableSignalKeyStore(state.keys, logger);

            setStatus('disconnected', 'Connecting...');
            
            let version = [2, 3000, 1017531301];
            let isLatest = false;
            try {
                console.log('WhatsApp: Fetching latest version...');
                const versionResult: any = await fetchLatestBaileysVersion();
                version = versionResult.version;
                isLatest = versionResult.isLatest;
                console.log(`WhatsApp: Fetched version v${version.join('.')}, isLatest: ${isLatest}`);
            } catch (err) {
                console.log('WhatsApp: Failed to fetch version, using fallback.', err);
            }
            
            const currentSock = makeWASocket({
                version,
                logger,
                auth: state,
                printQRInTerminal: false,
                browser: Browsers.macOS('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                qrTimeout: 60000,
                connectTimeoutMs: 60000, 
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000, 
                markOnlineOnConnect: true,
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

                    if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession || statusCode === 405 || (isTerminated && failureCount >= 3)) {
                        console.warn('WhatsApp: Terminal dissociation or connection failure (405). Purging auth data.');
                        try {
                            const entries = await getDocs(collection(db, 'wa_auth_bot1'));
                            for (const d of entries.docs) await deleteDoc(d.ref);
                        } catch(e) {}
                        setStatus('disconnected', 'Resetting Session...');
                        failureCount = 0;
                        reconnectTimer = setTimeout(() => connectToWhatsApp(), 5000); 
                    } else {
                        failureCount++;
                        const delay = Math.min(5000 + (failureCount * 2000), 30000);
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
            
            try {
                const entries = await getDocs(collection(db, 'wa_auth_bot1'));
                for (const d of entries.docs) await deleteDoc(d.ref);
            } catch(e) {}
            
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
