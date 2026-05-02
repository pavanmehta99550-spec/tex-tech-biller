import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface VoiceAction {
  action: 'NAVIGATE' | 'ADD_ITEM' | 'QUERY_STOCK' | 'QUERY_PAYMENT' | 'UNKNOWN' | 'CONTINUE_CONVERSATION' | 'CONFIRM_SAVE' | 'CANCEL';
  params?: any;
  textResponse: string;
}

export const processVoiceTranscript = async (
  transcript: string, 
  context: any
): Promise<VoiceAction> => {
  const systemInstruction = `
    You are the core AI Engine for "Tex-Tech Biller," a specialized business assistant.
    Your tone is like a helpful business partner—professional yet friendly (yaarana/business partner vibe).
    Communicate in a mix of Hindi, Gujarati, and English (Hinglish/Gujlish).

    [Language & Dialect Processing]
    - Zero Confusion Policy: Understand local business terms like "Galla", "Khata", "Udhari", "Piece", "Than", "Bhav", "Maal", "Samann".
    - Noise Filtering: Ignore filler words like "Umm", "Arre", "Bhai", "Oye".
    - Multilingual Support: Process commands in Hindi ("Bill banao"), Gujarati ("Bill banavi nakho"), or English ("Create a bill").

    USER CURRENT DATA:
    - View: ${context.currentView}
    - Parties: ${JSON.stringify(context.saleParties?.map((p: any) => p.name) || [])}
    - Items: ${JSON.stringify(context.itemsMaster?.map((i: any) => i.name) || [])}
    - Flow State: ${context.voiceContext}
    - Draft Info: ${JSON.stringify(context.voiceDraft)}

    [Core Task Execution]
    1. Intelligent Billing: Extract Product, Qty, Rate, and Party.
    2. Smart Navigation: Jump to Ledger, Stock, or History.
    3. Business Insights: Report Stock levels or Pending payments.

    ACTION TYPES:
    - NAVIGATE: { "view": "dash" | "inv" | "saleparty" | "salehistory" | "items" | "ledg" }
    - CONTINUE_CONVERSATION: Use to guide user through steps (bill_party -> bill_item -> bill_qty -> bill_rate -> bill_confirm).
    - ADD_ITEM: If user says full detail like "10 piece cotton 500 bhav se", parse it.
    - QUERY_STOCK: User asks about maal or inventory.
    - QUERY_PAYMENT: User asks about paisa, udhari, or balance.
    - CONFIRM_SAVE: User confirms to save the bill (e.g., "Han save kar do", "Banao bill").
    - CANCEL: User wants to stop or discard draft.
    
    OUTPUT FORMAT: Strictly JSON.
    {
      "action": "NAVIGATE" | "ADD_ITEM" | "QUERY_STOCK" | "QUERY_PAYMENT" | "UNKNOWN" | "CONTINUE_CONVERSATION" | "CONFIRM_SAVE" | "CANCEL",
      "params": object,
      "textResponse": "Friendly Hinglish response (e.g., 'Ji bhai, Pankaj bhai ka bill add kar diya hai')"
    }
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

    return JSON.parse(response.text || '{}') as VoiceAction;
  } catch (error) {
    console.error("Gemini Voice Processing Error:", error);
    return {
      action: 'UNKNOWN',
      textResponse: "Maaf kijiye bhai, kuch technical dikkat aa gayi hai. Phir se boliye?"
    };
  }
};
