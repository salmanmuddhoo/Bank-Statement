/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { AnalysisResult } from '../types';

/**
 * Sends the bank statement text to a secure backend endpoint for analysis and normalization.
 * @param statementText The raw text from the bank statement.
 * @returns A promise that resolves to the analysis result with normalized transactions.
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
