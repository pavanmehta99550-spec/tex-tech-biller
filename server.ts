import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";

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

async function startServer() {
    console.log('App: Starting server initialization...');
    const app = express();
    const PORT = Number(process.env.PORT) || 3000;

    app.get('/health', (req, res) => res.send('OK'));
    app.use(express.json({ limit: '50mb' }));

    // --- API TO GET DATA FROM CLOUD ---
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

    // --- API TO SAVE TO CLOUD ---
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

    app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));
}

startServer();
