/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from '../types';

const MODEL_NAME = "gemini-2.5-flash";

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Sends the bank statement text to the Gemini API for analysis and normalization.
 * @param statementText The raw text from the bank statement.
 * @param apiKey The user-provided Gemini API key.
 * @returns A promise that resolves to the analysis result with normalized transactions.
 */
export const analyzeStatement = async (statementText: string, apiKey: string): Promise<AnalysisResult> => {
  if (!statementText) {
    throw new Error('Statement text is empty.');
  }
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please provide a valid key.');
  }

  const ai = new GoogleGenAI({ apiKey });

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

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
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
    if (!jsonStr) {
      throw new Error("Received an empty response from the AI. The statement might not contain recognizable data.");
    }
    
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    if (errorMessage.includes('API key not valid')) {
        throw new Error('API key not valid. Please check your key and try again.');
    }
    if (errorMessage.includes('json') || errorMessage.includes('JSON')) {
        throw new Error('The AI returned an invalid format. Please try again or adjust the statement text.');
    }
    throw new Error(`Failed to analyze statement: ${errorMessage}`);
  }
};
