/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

const MODEL_NAME = "gemini-2.5-flash";

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    throw new Error("Gemini API Key not configured on the server.");
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

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "API key is not configured on the server. Please set the API_KEY environment variable in your Netlify site settings." }),
    };
  }

  try {
    const { statementText } = JSON.parse(event.body || '{}');
    if (!statementText) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing statementText in request body.' }),
      };
    }

    const currentAi = getAiInstance();

    const prompt = `Perform a deep analysis of the following bank statement text. Your goal is to extract key financial information and a clean, normalized list of transactions.

Your tasks are:
1.  **Extract Key Information**:
    *   **Statement Period**: The date range of the statement.
    *   **Opening Balance**: The starting balance.
    *   **Closing Balance**: The ending balance. Ensure this is the final figure listed.

2.  **Extract and Normalize Transactions**:
    *   Extract a list of ALL monetary transactions that affect the balance.
    *   For each transaction, identify the associated person or company name ('clientName').
    *   **CRITICAL**: Review all extracted client names. If you find variations of the same entity (e.g., "John Smith", "Mr J. Smith", "SMITH JOHN"), consolidate them under a single, standardized name (e.g., "John Smith"). Use this standardized name for all transactions related to that entity.
    *   For generic transactions (e.g., bank fees, interest), use the transaction description as the 'clientName'. Do not group these with personal names.
    *   For each transaction, provide the date (YYYY-MM-DD), amount, and type ('credit' or 'debit').

The final list of transactions must be complete to ensure that: Opening Balance + Total Credits - Total Debits = Closing Balance.

Statement:
---
${statementText}
---

Return a single JSON object adhering to the provided schema. The client names in the transaction list must be the final, standardized versions. If a value isn't found, use 0 for balances and an empty string for the period.`;

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
            statementPeriod: { type: Type.STRING, description: "The date range of the bank statement (e.g., 'January 2024')." },
            openingBalance: { type: Type.NUMBER, description: "The opening balance of the statement." },
            closingBalance: { type: Type.NUMBER, description: "The closing balance of the statement." },
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
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
    };

  } catch (error) {
    console.error("Error in /api/analyze function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Gemini API Error: ${errorMessage}` }),
    };
  }
};

export { handler };
