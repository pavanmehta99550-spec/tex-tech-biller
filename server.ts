import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";

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
            
            const prompt = "You are an AI Voice Assistant for a billing software. Your task is to process the user's speech and return ONLY a valid JSON object matching the requested action. \n" +
"Do not wrap the response in markdown blocks. Do not include any other text.\n" +
"Actions:\n" +
"- \"create_bill\": { \"action\": \"create_bill\", \"party\": \"Name\", \"amount\": 1000 }\n" +
"- \"delete_bill\": { \"action\": \"delete_bill\", \"party\": \"Name\" }\n" +
"- \"unknown\": { \"action\": \"unknown\", \"response\": \"Main samajh nahi payi, kripya dobara kahein.\" }\n\n" +
"User Speech: \"" + text + "\"";

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash-latest',
                contents: prompt,
            });

            const responseText = response.text || "{}";
            const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonObject = JSON.parse(cleanText);
            
            // Also generate a spoken response if not unknown
            if (jsonObject.action === 'create_bill') {
                jsonObject.response = "Ji, Maine " + jsonObject.party + " ka " + (jsonObject.amount || "0") + " rupay ka bill bana diya hai.";
            } else if (jsonObject.action === 'delete_bill') {
                jsonObject.response = "Ji, Maine " + jsonObject.party + " ka bill delete kar diya hai.";
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

    // --- API TO SEND EMAIL BACKUP ---
    app.post('/api/send-email-backup', async (req, res) => {
        const { backupData, backupEmail, smtpEmail, smtpPassword } = req.body;

        if (!backupEmail) {
            return res.status(400).json({ error: 'Receiver email is required.' });
        }

        // Try to get SMTP from params, or environment, or fallback safely
        const providerEmail = smtpEmail || process.env.SMTP_EMAIL;
        const providerPass = smtpPassword || process.env.SMTP_PASSWORD;

        if (!providerEmail || !providerPass) {
            return res.status(400).json({ 
                error: 'Sender SMTP Details not configured. Please add SMTP Email and App Password in Settings first.' 
            });
        }

        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: providerEmail,
                    pass: providerPass
                }
            });

            const backupStr = JSON.stringify(backupData, null, 2);
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `smart_gst_backup_${dateStr}.json`;

            const mailOptions = {
                from: `"Smart GST Biller Backup" <${providerEmail}>`,
                to: backupEmail,
                subject: `Smart GST Auto-Backup: ${new Date().toLocaleDateString('en-IN')}`,
                text: `Pranam!\n\nPlease find attached the automated data backup of your GST billing system.\n\nDate: ${new Date().toLocaleString('en-IN')}\n\nThis file contains details of all Parties, Purchases, Sales, Debit/Credit Notes, and Configurations as on export. You can restore this data in the "Data Protection Hub" by uploading this .json file.\n\n|| HAR HAR MAHADEV ||`,
                attachments: [
                    {
                        filename: filename,
                        content: backupStr,
                        contentType: 'application/json'
                    }
                ]
            };

            await transporter.sendMail(mailOptions);
            console.log('Backup email sent successfully to', backupEmail);
            res.json({ success: true, message: 'Backup email was sent successfully!' });
        } catch (error: any) {
            console.error('Nodemailer Error:', error);
            res.status(500).json({ error: error.message || 'SMTP service error occurred.' });
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
