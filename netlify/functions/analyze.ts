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
