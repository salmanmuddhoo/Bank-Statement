/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { AnalysisResult } from '../types';

/**
 * Sends the bank statement text to a secure backend endpoint for analysis.
 * @param statementText The raw text from the bank statement.
 * @returns A promise that resolves to the analysis result.
 */
export const analyzeStatement = async (statementText: string): Promise<AnalysisResult> => {
  const response = await fetch('/api/analyze', { // Calls the Netlify function via redirect
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statementText }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to analyze statement.' }));
    throw new Error(error.message || 'An unknown error occurred during analysis.');
  }
  return response.json();
};

/**
 * Sends a list of client names to a secure backend endpoint for normalization.
 * @param clientNames An array of client names extracted from the statement.
 * @returns A promise that resolves to a Map of original names to standardized names.
 */
export const normalizeClientNames = async (clientNames: string[]): Promise<Map<string, string>> => {
  if (clientNames.length === 0) {
    return new Map();
  }

  const response = await fetch('/api/normalize', { // Calls the Netlify function via redirect
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientNames }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to normalize names.' }));
    // As a fallback, return a map that doesn't change the names, preventing the app from crashing.
    console.warn(`Name normalization failed: ${error.message}. Using original names.`);
    const fallbackMap = new Map<string, string>();
    clientNames.forEach(name => fallbackMap.set(name, name));
    return fallbackMap;
  }
  
  const result = await response.json();
  // The backend sends a simple object, so we convert it back to a Map on the client.
  return new Map(Object.entries(result.nameMap || {}));
};
