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

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- FIREBASE CONFIG (Aapki Chabi) ---
const firebaseConfig = {
  apiKey: "AIzaSyAAylk4kI5has8jdwX0ef29vcRkLPoSoNw",
  authDomain: "clipnova-f259d.firebaseapp.com",
  projectId: "clipnova-f259d",
  storageBucket: "clipnova-f259d.firebasestorage.app",
  messagingSenderId: "1021594403404",
  appId: "1:1021594403404:web:19507943ef63890047aae9"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

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
    const PORT = Number(process.env.PORT) || 3000;

    app.get('/health', (req, res) => res.send('OK'));
    app.use(express.json({ limit: '50mb' }));

    let sock: any = null;
    let qrCode: string | null = null;
    let connectionStatus: string = 'disconnected';
    let detailedStatus: string = 'Idle';
    let failureCount = 0;

    let isInitializing = false;
    let initWatchdog: NodeJS.Timeout | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const clients = new Set<express.Response>();
    const broadcastStatus = () => {
        const data = JSON.stringify({ status: connectionStatus, detailedStatus, hasQr: !!qrCode, qr: qrCode });
        clients.forEach(client => { try { client.write(`data: ${data}\n\n`); } catch (e) { clients.delete(client); } });
    };

    const setStatus = (status: string, detailed: string = '') => {
        console.log(`WhatsApp Status Change: ${status} | ${detailed}`);
        connectionStatus = status;
        detailedStatus = detailed;
        broadcastStatus();
    };

    // --- NEW: API TO GET DATA FROM CLOUD ---
    app.get('/api/get-entries', async (req, res) => {
        try {
            const q = query(collection(db, "entries"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            const entries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(entries);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch from Cloud' });
        }
    });

    // --- UPDATED: API TO SAVE TO CLOUD ---
    app.post('/api/save-entry', async (req, res) => {
        const { billNumber, partyName, amount, phone } = req.body;

        try {
            // Save to Firebase
            await addDoc(collection(db, "entries"), {
                partyName,
                billNumber,
                amount,
                phone,
                timestamp: new Date().toISOString()
            });
            console.log('Data saved to Google Cloud!');
            res.json({ success: true, cloudSaved: true });
        } catch (error) {
            console.error('Cloud Save Error:', error);
            res.status(500).json({ error: 'Process failed' });
        }
    });

    // --- WHATSAPP SSE LOGIC ---
    app.get('/api/whatsapp/sse', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const sendData = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        sendData({ status: connectionStatus, detailedStatus, hasQr: !!qrCode, qr: qrCode });

        if (detailedStatus === 'Idle' && !isInitializing) connectToWhatsApp();

        const clientWriter = { write: (msg: string) => res.write(msg) } as express.Response;
        clients.add(clientWriter);
        req.on('close', () => clients.delete(clientWriter));
    });

    setInterval(() => {
        clients.forEach(client => {
            try { client.write(': heartbeat\n\n'); } catch (e) { clients.delete(client); }
        });
    }, 25000);

    app.get('/api/whatsapp/status', (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({ status: connectionStatus, detailedStatus, hasQr: !!qrCode, qr: qrCode });
    });

    app.post('/api/whatsapp/send-bill', async (req, res) => {
        const { phone, billNumber, pdfBase64, partyName, amount } = req.body;
        if (!phone || !pdfBase64) return res.status(400).json({ error: 'Phone and PDF required' });

        try {
            // 1. Save to Firebase
            await addDoc(collection(db, "entries"), {
                partyName,
                billNumber,
                amount,
                phone,
                timestamp: new Date().toISOString()
            });

            // 2. Send WhatsApp if connected
            if (connectionStatus === 'connected' && sock) {
                let cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
                const jid = `${cleanPhone}@s.whatsapp.net`;
                const buffer = Buffer.from(pdfBase64.split(',')[1], 'base64');

                await sock.sendMessage(jid, {
                    document: buffer,
                    fileName: `Bill_${billNumber || 'Invoice'}.pdf`,
                    mimetype: 'application/pdf',
                    caption: `Hello ${partyName || 'Customer'},\n\nAttached is your Bill #${billNumber || ''}.\n\nThank you!`
                });
            }
            res.json({ success: true });
        } catch (error) {
            console.error('WhatsApp Send Error:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    app.post('/api/whatsapp/logout', async (req, res) => {
        try {
            if (sock) {
                try { await sock.logout(); } catch (e) {}
                sock = null;
            }
            const authPath = path.join(process.cwd(), 'wa_auth');
            if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
            qrCode = null;
            setStatus('disconnected', 'Logged Out');
            isInitializing = false;
            res.json({ success: true });
            setTimeout(connectToWhatsApp, 2000);
        } catch (error) {
            res.status(500).json({ error: String(error) });
        }
    });

    app.post('/api/whatsapp/restart', (req, res) => {
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

    async function connectToWhatsApp() {
        if (isInitializing) return;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

        isInitializing = true;
        setStatus('disconnected', 'Initialising...');

        if (initWatchdog) clearTimeout(initWatchdog);
        initWatchdog = setTimeout(() => {
            if (isInitializing && connectionStatus !== 'connected') {
                isInitializing = false;
                setStatus('disconnected', 'Timeout: Resetting...');
                connectToWhatsApp();
            }
        }, 120000); 

        try {
            if (sock) {
                try { sock.ev.removeAllListeners(); sock.end(undefined); } catch (e) {}
                sock = null;
            }

            qrCode = null;
            const authPath = path.join(process.cwd(), 'wa_auth');
            if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            state.keys = makeCacheableSignalKeyStore(state.keys, logger);
            
            const { version } = await fetchLatestBaileysVersion();
            
            const currentSock = makeWASocket({
                version,
                logger,
                auth: state,
                printQRInTerminal: true,
                browser: Browsers.ubuntu('Chrome'),
                syncFullHistory: false,
                shouldSyncHistoryMessage: () => false,
                qrTimeout: 60000,
                connectTimeoutMs: 90000, 
                defaultQueryTimeoutMs: 120000,
                keepAliveIntervalMs: 20000, // Faster keepalive 
                markOnlineOnConnect: false,
                fireInitQueries: false,
                retryRequestDelayMs: 1000, 
                shouldIgnoreJid: (jid) => jid.includes('@broadcast'),
                getMessage: async (key) => { return { conversation: 'heartbeat' } }
            });

            sock = currentSock;

            currentSock.ev.on('connection.update', async (update: any) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    qrCode = await QRCode.toDataURL(qr);
                    setStatus('disconnected', 'Scan QR Code');
                }

                if (connection === 'close') {
                    isInitializing = false;
                    qrCode = null;
                    const error = lastDisconnect?.error as Boom;
                    const statusCode = error?.output?.statusCode;
                    const errorMsg = error?.message || '';
                    
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    // Handle "Connection Terminated by Server" (often 515 or 440 or handshake timeout)
                    const isTerminated = statusCode === 515 || statusCode === 440 || errorMsg.includes('Terminated by Server');

                    if (!shouldReconnect) {
                        setStatus('disconnected', 'Logged Out');
                    } else {
                        failureCount++;
                        const delay = Math.min(5000 + (failureCount * 2000), 60000); // Backoff up to 1 min
                        console.log(`WhatsApp: Reconnecting in ${delay/1000}s... (Reason: ${errorMsg || statusCode})`);
                        setStatus('disconnected', isTerminated ? 'Server Disconnect: retrying...' : 'Offline: Reconnecting...');
                        reconnectTimer = setTimeout(() => connectToWhatsApp(), delay);
                    }
                } else if (connection === 'open') {
                    isInitializing = false;
                    failureCount = 0;
                    qrCode = null;
                    if (initWatchdog) { clearTimeout(initWatchdog); initWatchdog = null; }
                    setStatus('connected', 'Connected');
                }
            });

            currentSock.ev.on('creds.update', saveCreds);
        } catch (e) {
            isInitializing = false;
            failureCount++;
            setStatus('disconnected', 'Crash: Retry in 10s');
            reconnectTimer = setTimeout(() => connectToWhatsApp(), 10000);
        }
    }

    const distPath = path.join(process.cwd(), 'dist');
    const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);
    
    if (!isProd) {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa'
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(distPath));
        app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }

    connectToWhatsApp();
    app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));
}

startServer();
