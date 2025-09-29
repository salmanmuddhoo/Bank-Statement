/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AnalysisResult } from '../types.ts';

const MODEL_NAME = "gemini-2.5-flash";

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    statementPeriod: { 
      type: Type.STRING,
      description: "The date range of the statement, or the 'as of' date.",
    },
    openingBalance: { 
      type: Type.NUMBER,
      description: "The starting balance of the account for the period.",
    },
    closingBalance: { 
      type: Type.NUMBER,
      description: "The final ending balance of the account for the period.",
    },
    transactions: {
      type: Type.ARRAY,
      description: "A comprehensive list of every transaction within the period.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { 
            type: Type.STRING,
            description: "Transaction date in YYYY-MM-DD format.",
          },
          amount: { 
            type: Type.NUMBER,
            description: "The positive value of the transaction.",
          },
          type: { 
            type: Type.STRING,
            description: "Either 'credit' for money in, or 'debit' for money out.",
          },
          clientName: { 
            type: Type.STRING,
            description: "The standardized name of the client, merchant, or payee after consolidation rules are applied.",
          },
        },
        required: ['date', 'amount', 'type', 'clientName'],
      },
    },
  },
  required: ['statementPeriod', 'openingBalance', 'closingBalance', 'transactions'],
};


/**
 * Sends the bank statement text to the Gemini API for analysis and normalization.
 * @param statementText The raw text from the bank statement.
 * @param apiKey The user-provided Gemini API key.
 * @returns A promise that resolves to the final, parsed analysis result.
 */
export const analyzeStatement = async (
  statementText: string,
  apiKey: string
): Promise<AnalysisResult> => {
  console.log("[analyzeStatement] Function called.");
  if (!statementText) {
    throw new Error('Statement text is empty.');
  }
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please provide a valid key.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Your sole task is to act as an expert financial data extractor. Analyze the provided bank statement text and populate a JSON object according to the exact schema provided.

**CRITICAL MANDATE: Perfect Balance Verification**
This is your most important instruction. Before outputting the final JSON, you MUST internally perform this calculation:
\`Opening Balance + Sum(all Credits) - Sum(all Debits) = Closing Balance\`

*   **Step 1: Preliminary Extraction**. Extract the opening balance, closing balance, and every single transaction line. Do not miss any, especially small bank fees or charges like "Standing Order Charges".
*   **Step 2: Internal Calculation**. Sum all extracted credit amounts and all extracted debit amounts.
*   **Step 3: Verification**. Apply the formula.
*   **Step 4: Self-Correction (Crucial)**. If the balance does not match, DO NOT output the JSON. Instead, re-read the original statement text meticulously. Look for transactions you missed, numbers you misinterpreted (e.g., \`1,500.00\` vs \`1500.00\`), or items you misclassified. Repeat the process until the equation is perfectly satisfied.
*   **Step 5: Final Output**. Only after the balance is verified, generate the final JSON.

**Data Extraction & Normalization Rules:**

1.  **Header Fields**:
    *   \`statementPeriod\`: The "as of" date or date range.
    *   \`openingBalance\` / \`closingBalance\`: The start and end balances.

2.  **Transactions Array**:
    *   \`date\`: Convert 'DD-Mon-YYYY' from the 'Transaction Date' column to 'YYYY-MM-DD'.
    *   \`type\`: Set to 'credit' if the amount is in the Credit column, 'debit' if in the Debit column.
    *   \`amount\`: The positive numeric value.
    *   \`clientName\`: Consolidate this field using the following strict rules:
        *   **Standardize Name**: Always remove prefixes like "Mr", "Mrs", "Miss". "MUHAMMUD SALMAN MUDDHOO" and "Mr Muhammud Salman Muddhoo" MUST become "Muhammud Salman Muddhoo".
        *   **Alias/Variation Consolidation**: When you encounter names that likely refer to the same person, consolidate them to the most complete version. For example, if you see transactions for both "Muhammud Salman" and "Muhammud Salman Muddhoo", you MUST standardize both to "Muhammud Salman Muddhoo". Apply this logic to similar cases where a partial name and a more complete name appear for what is clearly the same entity.
        *   **Identify Merchant/Payee**:
            *   For "Debit Card Purchase": The client is the merchant name that follows. Ex: "Debit Card Purchase WINNER'S" -> "WINNER'S". Consolidate "WINNERS-ST PIERRE" to "WINNER'S".
            *   For "JUICE Transfer", "Credit Card Transfer", etc.: The name is typically at the end of the line. Ex: "JUICE Transfer Umrah MRS R BOH BOOLAKY-MUDDHOO" -> "R BOH BOOLAKY-MUDDHOO".
            *   For "Standing Order": The client is the entity named in the description. Ex: "Standing Order... THE EDUCATION TRUST" -> "THE EDUCATION TRUST".
        *   **Categorize Fees**: Generic bank charges should be categorized. Ex: "Standing Order Charges" -> "Bank Charges". "MCB Juice Payment Central Electricity Board" -> "Central Electricity Board".

**JSON Output Format:**
The output MUST be a single, valid JSON object that conforms to the schema. Do not include any other text, explanations, or markdown formatting like \`\`\`json.

**Bank Statement Text to Analyze:**
---
${statementText}
---`;

  console.log("[analyzeStatement] Constructed prompt for Gemini:", { promptLength: prompt.length });

  try {
    console.info("[analyzeStatement] Sending request to Gemini API (non-streaming in JSON mode)...");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        safetySettings,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        // Add token limits to prevent truncation on large statements, which can cause JSON parsing errors.
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    });

    let jsonStr = response.text;
    
    console.info("[analyzeStatement] Received full JSON string from AI.");

    if (!jsonStr) {
      throw new Error("Received an empty response from the AI. The statement might not contain recognizable data.");
    }
    
    // With JSON mode, the response should be a valid JSON string directly.
    // As a safeguard, we try to extract from markdown fences in case the model wraps the output.
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      console.log("[analyzeStatement] Extracted JSON from markdown block.");
      jsonStr = jsonMatch[1];
    }
    
    const sanitizedJsonStr = jsonStr.trim();
    
    if (!sanitizedJsonStr) {
        console.error("The AI's response was empty after trimming.", jsonStr);
        throw new Error("The AI returned an empty response.");
    }

    const parsedResult = JSON.parse(sanitizedJsonStr);
    console.info("[analyzeStatement] Successfully parsed analysis result.");
    return parsedResult;

  } catch (error) {
    console.error("[analyzeStatement] Error during AI analysis:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    if (errorMessage.includes('API key not valid')) {
        throw new Error('API key not valid. Please check your key and try again.');
    }
    // Provide a more specific error for JSON parsing issues, which often stem from large/complex statements.
    if (error instanceof SyntaxError || (errorMessage.includes('json') || errorMessage.includes('JSON'))) {
        throw new Error('The AI returned an invalid format. This can happen with large or complex statements that exceed the model\'s output limit. Please try again.');
    }
    throw new Error(`Failed to analyze statement: ${errorMessage}`);
  }
};