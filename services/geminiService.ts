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
  console.log("[analyzeStatement] Function called.");
  if (!statementText) {
    throw new Error('Statement text is empty.');
  }
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please provide a valid key.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Perform a deep analysis of the following bank statement text. Your goal is to extract key financial information and a clean, normalized list of transactions with consolidated client names.

Your tasks are:
1.  **Extract Key Information**:
    *   **Statement Period**: The date range of the statement.
    *   **Opening Balance**: The starting balance.
    *   **Closing Balance**: The ending balance. Ensure this is the final figure listed.

2.  **Extract, Normalize, and Consolidate Transactions**:
    *   Extract a list of ALL monetary transactions that affect the balance.
    *   For each transaction, identify the associated person or company name ('clientName').
    *   **CRITICAL - ADVANCED Client Name Consolidation**: This is the most important task. You must be extremely diligent in merging variations of the same client name into a single, consistent identifier.
        *   **Step 1: Strip Titles**. Before comparing names, remove common titles and honorifics like "Mr", "Mrs", "Miss", "M/s", "Dr". The final consolidated name should NOT include these titles.
        *   **Step 2: Normalize**. After stripping titles, ignore case, punctuation, and word order to identify matches.
        *   **Step 3: Consolidate**. Group clients based on the core name components. Always choose the most complete version of the name as the final identifier.
        *   **Example 1**: "Mr muhammud Salman Muddhoo" and "Muhammud Salman Muddhoo" are the same person. You must consolidate them under "Muhammud Salman Muddhoo". Note how the title "Mr" is removed from the final name.
        *   **Example 2**: A client might appear as "Muhammud Salman", "MUHAMMUD SALMAN MUDDHOO", or "Mr muddhoo salman". All of these should be consolidated into a single name: "Muhammud Salman Muddhoo".
        *   **Example 3**: "J. Doe" and "John Doe" should be consolidated into "John Doe".
    *   For generic transactions (e.g., bank fees, interest), use the transaction description as the 'clientName'. Do not group these with personal names.
    *   For each transaction, provide the date (YYYY-MM-DD), amount, and type ('credit' or 'debit').

The final list of transactions must be complete to ensure that: Opening Balance + Total Credits - Total Debits = Closing Balance.

Statement:
---
${statementText}
---

Return a single JSON object adhering to the provided schema. The client names in the transaction list must be the final, standardized versions. If a value isn't found, use 0 for balances and an empty string for the period.`;

  console.log("[analyzeStatement] Constructed prompt for Gemini:", { prompt });

  try {
    console.info("[analyzeStatement] Sending request to Gemini API...");
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
                  clientName: { type: Type.STRING, description: "The consolidated, standardized name of the client or a descriptive label for the transaction. Titles like 'Mr' or 'Mrs' must be removed." },
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
    console.info("[analyzeStatement] Received raw JSON response from Gemini:", jsonStr);

    if (!jsonStr) {
      throw new Error("Received an empty response from the AI. The statement might not contain recognizable data.");
    }
    
    const parsedResult = JSON.parse(jsonStr);
    console.info("[analyzeStatement] Parsed analysis result:", parsedResult);
    return parsedResult;

  } catch (error) {
    console.error("[analyzeStatement] Error calling Gemini API:", error);
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