/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from '../types';


// ===================================================================================
// CRITICAL SECURITY NOTE FOR DEPLOYMENT
// ===================================================================================
// The current implementation calls the Gemini API directly from the user's browser.
// This is okay for development, but it is INSECURE for a deployed application.
// Deploying this code as-is would expose your API key to the public.
//
// TO DEPLOY SAFELY:
// 1. You MUST create a backend proxy (e.g., a serverless function on Vercel, Netlify, or Google Cloud).
// 2. The backend proxy will securely store your API key and make the calls to the Gemini API.
// 3. Your frontend application will then call your backend proxy instead of Google's API directly.
//
// Below, the current working (but insecure) code is kept for this development environment.
// Further down, you will find commented-out examples of how to structure your code
// for a secure deployment.
// ===================================================================================


// --- CURRENT (INSECURE) IMPLEMENTATION FOR DEVELOPMENT ---
// This code works in this sandboxed environment but should NOT be deployed.

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

const MODEL_NAME = "gemini-2.5-flash";

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API Key not configured. Set process.env.API_KEY.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export const analyzeStatement = async (statementText: string): Promise<AnalysisResult> => {
  const currentAi = getAiInstance();

  const prompt = `Perform a deep analysis of the following bank statement text. Your primary goal is to extract information so that the opening balance plus total credits minus total debits perfectly matches the closing balance.

Extract the following information:
1.  **Statement Period**: The date range of the statement (e.g., "January 2024", "Jan 1, 2024 - Jan 31, 2024").
2.  **Opening Balance**: The starting balance of the statement period.
3.  **Closing Balance**: The ending balance of the statement period.
4.  **Transactions**: Extract a list of ALL monetary transactions that affect the balance. Do NOT ignore any transaction.
    - If a transaction is clearly associated with a person or company, extract their name as 'clientName'.
    - For transactions without a specific person or company name (e.g., bank fees, interest, service charges), use the actual transaction description or narration text from the statement itself as the 'clientName'. For example, if the statement line reads "MONTHLY ACCOUNT FEE", the clientName should be "MONTHLY ACCOUNT FEE".
    - For each transaction, extract the date (YYYY-MM-DD), the amount, and classify it as 'credit' or 'debit'.

Statement:
---
${statementText}
---

Return the data as a JSON object that adheres to the provided schema. Ensure the transaction list is complete to guarantee the balances match. If a value isn't found, use 0 for balances and an empty string for the period.`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        // Optimize for speed by disabling the model's "thinking" feature
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            statementPeriod: {
              type: Type.STRING,
              description: "The date range of the bank statement (e.g., 'January 2024')."
            },
            openingBalance: {
              type: Type.NUMBER,
              description: "The opening balance of the statement."
            },
            closingBalance: {
              type: Type.NUMBER,
              description: "The closing balance of the statement."
            },
            transactions: {
              type: Type.ARRAY,
              description: "A list of all transactions affecting the balance.",
              items: {
                type: Type.OBJECT,
                properties: {
                  clientName: { type: Type.STRING, description: "The name of the client or a descriptive label for the transaction." },
                  date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format." },
                  amount: { type: Type.NUMBER, description: "Transaction amount." },
                  type: { type: Type.STRING, description: "Type: 'credit' or 'debit'.", enum: ["credit", "debit"] }
                },
                required: ["clientName", "date", "amount", "type"],
              },
            },
          },
          required: ["statementPeriod", "openingBalance", "closingBalance", "transactions"],
        },
      },
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);

    // Provide default values to ensure the return type is always correct
    return {
      statementPeriod: result.statementPeriod || '',
      openingBalance: result.openingBalance || 0,
      closingBalance: result.closingBalance || 0,
      transactions: Array.isArray(result.transactions) ? result.transactions.filter((t: any) =>
        typeof t.clientName === 'string' &&
        typeof t.date === 'string' &&
        typeof t.amount === 'number' &&
        (t.type === 'credit' || t.type === 'debit')
      ) : [],
    };

  } catch (error) {
    console.error("Error calling Gemini API for statement analysis:", error);
    if (error instanceof Error) {
      const googleError = error as any;
      if (googleError.message && googleError.message.includes("API key not valid")) {
        throw new Error("Invalid API Key. Please check your API_KEY environment variable.");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("API quota exceeded. Please check your Gemini API quota.");
      }
      if (googleError.type === 'GoogleGenAIError' && googleError.message) {
        throw new Error(`Gemini API Error: ${googleError.message}`);
      }
      throw new Error(`Failed to analyze statement: ${error.message}`);
    }
    throw new Error("Failed to analyze statement due to an unknown error.");
  }
};

export const normalizeClientNames = async (clientNames: string[]): Promise<Map<string, string>> => {
  if (clientNames.length === 0) {
    return new Map();
  }
  const currentAi = getAiInstance();

  const prompt = `Review the following list of client names. Some names might be variations of the same person (e.g., "Salman Muddhoo", "Mr Salman Muddhoo", "MUHAMMUD SALMAN MUDDHOO"). Group these similar names together under a single, standardized name. The standardized name should be the most complete and formal version available from the variations. Generic labels like "Bank Fee" or "Salary Deposit" should not be grouped with personal names and should remain as they are.

Client Names:
---
${clientNames.join('\n')}
---

Return the data as a JSON object that adheres to the provided schema. Each group should contain the standardized name and all the original name variations that belong to it. If a name has no variations, it should still be in its own group.`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nameGroups: {
              type: Type.ARRAY,
              description: "A list of groups, where each group represents a single client entity.",
              items: {
                type: Type.OBJECT,
                properties: {
                  standardizedName: {
                    type: Type.STRING,
                    description: "The single, standardized name for this client (e.g., the most complete version)."
                  },
                  originalNames: {
                    type: Type.ARRAY,
                    description: "A list of all original name variations that belong to this standardized name.",
                    items: {
                      type: Type.STRING
                    }
                  }
                },
                required: ["standardizedName", "originalNames"]
              }
            }
          },
          required: ["nameGroups"]
        }
      }
    });

    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    const nameMap = new Map<string, string>();

    if (result && Array.isArray(result.nameGroups)) {
      for (const group of result.nameGroups) {
        if(group.standardizedName && Array.isArray(group.originalNames)) {
          for (const originalName of group.originalNames) {
            nameMap.set(originalName, group.standardizedName);
          }
        }
      }
    } else {
       console.warn("Parsed response, but 'nameGroups' array not found or invalid:", result);
       // Fallback: if normalization fails, use original names
       clientNames.forEach(name => nameMap.set(name, name));
    }
    return nameMap;

  } catch (error) {
    console.error("Error calling Gemini API for name normalization:", error);
    // If normalization fails, return a map that uses original names as a fallback
    // to avoid crashing the application.
    console.warn("Falling back to using original, unnormalized names.");
    const fallbackMap = new Map<string, string>();
    clientNames.forEach(name => fallbackMap.set(name, name));
    return fallbackMap;
  }
};


// ===================================================================================
// EXAMPLE CODE FOR A SECURE DEPLOYMENT
// ===================================================================================

/*
// STEP 1: Replace the content of THIS file (`services/geminiService.ts`) with the code below.
// This becomes your secure frontend client that calls your backend proxy.

import { AnalysisResult } from '../types';

export const analyzeStatement = async (statementText: string): Promise<AnalysisResult> => {
  const response = await fetch('/api/analyze', { // The path to your backend endpoint
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statementText }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to analyze statement.');
  }
  return response.json();
};

export const normalizeClientNames = async (clientNames: string[]): Promise<Map<string, string>> => {
  const response = await fetch('/api/normalize', { // The path to your backend endpoint
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientNames }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to normalize names.');
  }
  const result = await response.json();
  // The backend sends a simple object, so we convert it back to a Map here.
  return new Map(Object.entries(result.nameMap));
};
*/


/*
// STEP 2: Create a backend file (e.g., `/api/analyze.ts`) on your server.
// This is where your secret API key lives. This code NEVER runs in the user's browser.
// The example below is for a generic server environment; you will need to adapt it
// to your specific hosting provider's conventions (e.g., for Vercel, Netlify, etc.).

import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

// This is now on your secure server, read from server environment variables
const API_KEY = process.env.API_KEY; // Your key is safe here
const ai = new GoogleGenAI({ apiKey: API_KEY });
const MODEL_NAME = "gemini-2.5-flash";
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// This function would handle requests to your `/api/analyze` endpoint
async function handleAnalysisRequest(requestBody) { // The 'requestBody' comes from your server framework
  const { statementText } = requestBody;
  const prompt = `Perform a deep analysis...`; // The same long prompt for analysis goes here
  
  const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { ... }, // The same config as the original function
  });

  const jsonStr = response.text.trim();
  return JSON.parse(jsonStr); // Your server sends this JSON back to the frontend
}

// This function would handle requests to your `/api/normalize` endpoint
async function handleNormalizationRequest(requestBody) {
    const { clientNames } = requestBody;
    const prompt = `Review the following list of client names...`; // The same long prompt for normalization

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { ... }, // The same config as the original function
    });
    
    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);
    const nameMap = new Map();
    
    if (result && Array.isArray(result.nameGroups)) {
      for (const group of result.nameGroups) {
        if (group.standardizedName && Array.isArray(group.originalNames)) {
          for (const originalName of group.originalNames) {
            nameMap.set(originalName, group.standardizedName);
          }
        }
      }
    }

    // You can't send a Map over JSON directly, so convert it to an object
    const nameMapObject = Object.fromEntries(nameMap);
    return { nameMap: nameMapObject }; // Send this object back to the frontend
}
*/
