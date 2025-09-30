/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { UploadCloud, ReceiptText, X, Zap, Loader2 } from './Icons.tsx';

interface StatementInputProps {
  statementText: string;
  onStatementChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string | null;
  isParsingFile: boolean;
  clearFile: () => void;
  handleAnalyze: () => void;
  isLoading: boolean;
  apiKey: string;
  // New props for payments file
  paymentsFileName: string | null;
  isParsingPaymentsFile: boolean;
  handlePaymentsFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearPaymentsFile: () => void;
}

const StatementInput: React.FC<StatementInputProps> = ({
  statementText,
  onStatementChange,
  handleFileChange,
  fileName,
  isParsingFile,
  clearFile,
  handleAnalyze,
  isLoading,
  apiKey,
  paymentsFileName,
  isParsingPaymentsFile,
  handlePaymentsFileChange,
  clearPaymentsFile,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="statement-input" className="block text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Paste Bank Statement
          </label>
          <textarea
            id="statement-input"
            value={statementText}
            onChange={onStatementChange}
            placeholder="Paste your bank statement text here..."
            className="w-full h-80 bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200 resize-none"
            readOnly={!!fileName}
          />
        </div>
        <div className="flex flex-col justify-center bg-slate-100/80 dark:bg-slate-800/40 rounded-lg p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 space-y-4">
          {/* Statement Upload */}
          <div className="text-center flex-1 flex flex-col justify-center">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">1. Bank Statement (Required)</h3>
            <div className="mt-2 flex-grow flex flex-col justify-center">
              {fileName ? (
                <div className="text-center">
                  <ReceiptText className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{fileName}</p>
                  {isParsingFile && <p className="text-sm text-sky-500 dark:text-sky-400 mt-2 animate-pulse">Parsing File...</p>}
                  <button onClick={clearFile} className="mt-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    <X className="w-4 h-4 mr-2" /> Clear
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700">
                    <UploadCloud className="w-5 h-5 mr-3" /> Upload Statement
                  </label>
                  <input id="file-upload" type="file" className="hidden" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Supports CSV, XLS, XLSX</p>
                </>
              )}
            </div>
          </div>

          <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600"></div>

          {/* Expected Payments Upload */}
          <div className="text-center flex-1 flex flex-col justify-center">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300">2. Expected Payments (Optional)</h3>
             <div className="mt-2 flex-grow flex flex-col justify-center">
              {paymentsFileName ? (
                 <div className="text-center">
                  <ReceiptText className="w-16 h-16 text-sky-500 dark:text-sky-400 mx-auto mb-4" />
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{paymentsFileName}</p>
                  {isParsingPaymentsFile && <p className="text-sm text-sky-500 dark:text-sky-400 mt-2 animate-pulse">Parsing File...</p>}
                  <button onClick={clearPaymentsFile} className="mt-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    <X className="w-4 h-4 mr-2" /> Clear
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="payments-file-upload" className="cursor-pointer inline-flex items-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <UploadCloud className="w-5 h-5 mr-3" /> Upload Payments
                  </label>
                  <input id="payments-file-upload" type="file" className="hidden" accept=".xls,.xlsx" onChange={handlePaymentsFileChange} />
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Supports XLS, XLSX</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 text-center">
         <button
          onClick={handleAnalyze}
          disabled={isLoading || isParsingFile || !statementText.trim() || !apiKey}
          className="w-full max-w-xs inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-lg shadow-sky-500/30 dark:shadow-sky-900/50 text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 mr-3" />
              Analyze Statement
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StatementInput;
