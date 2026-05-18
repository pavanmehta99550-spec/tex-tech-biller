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

    // --- API FOR VOICE ASSISTANT (GEMINI) ---
    app.post('/api/voice-command', async (req, res) => {
        try {
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: 'No text provided' });
            
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: 'No Gemini API Key found in env' });
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });
            
            const prompt = `You are an AI Voice Assistant for a billing software. Your task is to process the user's speech and return ONLY a valid JSON object matching the requested action. 
Do not wrap the response in markdown blocks. Do not include any other text.
Actions:
- "create_bill": { "action": "create_bill", "party": "Name", "amount": 1000 }
- "delete_bill": { "action": "delete_bill", "party": "Name" }
- "unknown": { "action": "unknown", "response": "Main samajh nahi payi, kripya dobara kahein." }

User Speech: "${text}"`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const responseText = response.text || "{}";
            const cleanText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
            const jsonObject = JSON.parse(cleanText);
            
            // Also generate a spoken response if not unknown
            if (jsonObject.action === 'create_bill') {
                jsonObject.response = \`Ji, Maine \${jsonObject.party} ka \${jsonObject.amount} rupay ka bill bana diya hai.\`;
            } else if (jsonObject.action === 'delete_bill') {
                jsonObject.response = \`Ji, Maine \${jsonObject.party} ka bill delete kar diya hai.\`;
            }

            res.json(jsonObject);
        } catch (error) {
            console.error('Gemini Voice Command Error:', error);
            res.status(500).json({ error: 'Failed to process voice command' });
        }
    });

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
