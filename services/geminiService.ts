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
 * Streams the response back chunk by chunk for a more responsive UI.
 * @param statementText The raw text from the bank statement.
 * @param apiKey The user-provided Gemini API key.
 * @param onChunk A callback function that receives raw text chunks as they arrive from the API.
 * @returns A promise that resolves to the final, parsed analysis result.
 */
export const analyzeStatement = async (
  statementText: string,
  apiKey: string,
  onChunk: (chunk: string) => void
): Promise<AnalysisResult> => {
  console.log("[analyzeStatement] Function called.");
  if (!statementText) {
    throw new Error('Statement text is empty.');
  }
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please provide a valid key.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Your primary objective is to perform a meticulous and comprehensive financial analysis of the provided bank statement text. The final output must be a single JSON object, and it is imperative that the extracted transaction data is complete and accurate, such that the statement balances perfectly.

**Core Requirement: Balance Verification**
The extracted data MUST satisfy the following equation:
\`Opening Balance + Sum of all Credits - Sum of all Debits = Closing Balance\`
Before finalizing the JSON output, you must internally verify this equation. If it does not balance, you MUST re-analyze the statement to find any missed or miscategorized transactions until the equation holds true. This is the most critical instruction.

**Extraction Tasks:**

1.  **Extract Key Financial Headers**:
    *   \`statementPeriod\`: The date range covered by the statement.
    *   \`openingBalance\`: The starting balance for the period.
    *   \`closingBalance\`: The final ending balance for the period.

2.  **Extract, Normalize, and Consolidate ALL Transactions**:
    *   Identify and extract EVERY single transaction that impacts the balance. This includes, but is not limited to:
        *   Customer payments (deposits, transfers in).
        *   Withdrawals and payments made by the account holder.
        *   **All bank-related fees**: service charges, monthly fees, transfer fees, processing fees, etc.
        *   **Government charges**: taxes, levies, duties.
        *   **Interest payments**: both credited and debited.
    *   For each transaction, determine the following:
        *   \`date\`: Transaction date in YYYY-MM-DD format.
        *   \`amount\`: The positive value of the transaction.
        *   \`type\`: Must be either 'credit' (money in) or 'debit' (money out).
        *   \`clientName\`: The associated person, company, or a clear description of the transaction.

3.  **Advanced Client Name Consolidation (CRITICAL)**:
    *   Your second most important task is to merge variations of the same client name into a single, consistent identifier.
    *   **Step 1: Strip Titles**. Before comparing, remove titles like "Mr", "Mrs", "Miss", "M/s", "Dr". The final consolidated name MUST NOT include these titles.
    *   **Step 2: Normalize**. Ignore case, punctuation, and word order to identify matches.
    *   **Step 3: Consolidate**. Group clients by their core name components. Always use the most complete version of the name as the final identifier.
    *   **Examples**:
        *   "Mr muhammud Salman Muddhoo" and "Muhammud Salman Muddhoo" consolidate to "Muhammud Salman Muddhoo".
        *   "Muhammud Salman", "MUHAMMUD SALMAN MUDDHOO", and "Mr muddhoo salman" consolidate to "Muhammud Salman Muddhoo".
        *   "J. Doe" and "John Doe" consolidate to "John Doe".
    *   For generic transactions (e.g., "Monthly Service Fee", "Interest Paid"), use that exact description as the \`clientName\`. Do not attempt to group these with personal names.

**Final Output Instructions**:
*   The entire output must be a single, valid JSON object that strictly follows the provided schema.
*   The list of transactions must be exhaustive.
*   The client names within the \`transactions\` array must be the final, standardized versions.
*   If a value isn't found, use 0 for numeric fields and an empty string for text fields.

**Bank Statement Text:**
---
${statementText}
---`;

  console.log("[analyzeStatement] Constructed prompt for Gemini:", { promptLength: prompt.length });

  try {
    console.info("[analyzeStatement] Sending request to Gemini API (streaming)...");
    const response = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        safetySettings
      },
    });

    let jsonStr = '';
    for await (const chunk of response) {
      const chunkText = chunk.text;
      if (chunkText) {
        jsonStr += chunkText;
        onChunk(chunkText);
      }
    }
    
    console.info("[analyzeStatement] Received full JSON string from stream:", jsonStr);

    if (!jsonStr) {
      throw new Error("Received an empty response from the AI. The statement might not contain recognizable data.");
    }
    
    // Sanitize the response: sometimes the model wraps it in ```json ... ``` or includes other text
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
    const sanitizedJsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[2]).trim() : '';
    
    if (!sanitizedJsonStr) {
        console.error("Could not find a valid JSON object in the AI's response.", jsonStr);
        throw new Error("The AI returned a response, but it did not contain a valid JSON object.");
    }

    const parsedResult = JSON.parse(sanitizedJsonStr);
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