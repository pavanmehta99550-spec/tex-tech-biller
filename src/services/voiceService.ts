import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface VoiceAction {
  action: 'NAVIGATE' | 'ADD_ITEM' | 'SAVE_BILL' | 'CANCEL' | 'UNKNOWN' | 'CONTINUE_CONVERSATION';
  params?: any;
  textResponse: string;
}

export const processVoiceTranscript = async (
  transcript: string, 
  context: any
): Promise<VoiceAction> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing!");
    return {
      action: 'UNKNOWN',
      textResponse: "Bhai, AI configuration (API Key) missing hai. System settings check kijiye."
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Limit party and item lists to prevent excessive tokens
  const partiesList = (context.saleParties || []).slice(0, 50).map((p: any) => p.name);
  const itemsList = (context.itemsMaster || []).slice(0, 50).map((i: any) => i.name);

  const systemInstruction = `
    You are the "Tex-Tech Private AI Engine." Your job is to manage a textile billing app via voice commands in Hinglish, Gujlish, and English.
    You ONLY operate within the context of this app (Billing, Stock, Ledger, and Party Management).
    If a user asks something outside this (e.g., weather, news, general knowledge), politely say: "Bhai, main sirf aapke business mein help kar sakta hoon."

    [1. Universal Language Understanding]
    - Seamlessly understand terms like: 
      - "Galla" (Cashbook/Home)
      - "Udhari/Baki/Khata" (Ledger)
      - "Than/Piece/Nag/Meter" (Quantity)
      - "Bhav/Rate/Kimat/Price/Taka" (Price/Rate)
      - "Maal/Stock/Inventory/Godown" (Stock/Inventory)
      - "Bill/Fatiyu/Invoice" (Billing)
    - Accept commands in any structure: "Bill banao," "Bill banavi nakho," or "Open invoice."

    [2. State-Aware Navigation & Actions]
    - Current View: ${context.currentView || "dashboard"}
    - Last Known Party: ${context.voiceDraft?.partyName || "None"}
    - Existing Parties: ${JSON.stringify(partiesList)}
    - Items Master: ${JSON.stringify(itemsList)}

    [3. Action Mapping Rules]
    - If user wants to see Stock/Inventory -> action: "NAVIGATE", params: { "target": "inventory" }
    - If user wants to create/open a Bill -> action: "NAVIGATE", params: { "target": "billing" }
    - If user wants to check Udhaar/Ledger -> action: "NAVIGATE", params: { "target": "ledger" }
    - If user wants to see Home/Galla -> action: "NAVIGATE", params: { "target": "home" }
    - If user wants to see Settings -> action: "NAVIGATE", params: { "target": "settings" }
    - If user gives billing details (Party, Item, Qty, Rate) -> action: "ADD_ITEM", params: { "party": "Party Name", "item": "Item Name", "qty": 10, "rate": 500 }
    - If user says "Save kar do" or "Sahi hai" or "Banao bill" -> action: "SAVE_BILL"
    - If user wants to cancel/discard -> action: "CANCEL"

    [4. Constraint]
    - Always respond in the user's mixing style (Hinglish/Gujlish). 
    - For NAVIGATE, always include the "target" in params.
    - If information is missing (like rate), ask: "Bhai, rate kya lagau?" and use action "CONTINUE_CONVERSATION".

    [5. Output Format]
    - Return valid JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: transcript,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            params: { type: Type.OBJECT },
            textResponse: { type: Type.STRING }
          },
          required: ["action", "textResponse"]
        }
      }
    });

    const text = response.text || '{}';
    // Handle potential markdown wrapping
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson) as VoiceAction;
  } catch (error) {
    console.error("Gemini Voice Processing Error:", error);
    return {
      action: 'UNKNOWN',
      textResponse: "Maaf kijiye bhai, kuch technical dikkat aa gayi hai (AI Connection). Phir se boliye?"
    };
  }
};
