/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { AnalysisResult } from '../types.ts';
import { CheckCircle2, XCircle, MessageSquareWarning } from './Icons.tsx';

interface StatementOverviewProps {
  analysisResult: AnalysisResult;
  balanceVerification: { calculatedClosing: number; difference: number; isMatch: boolean; } | null;
  formatCurrency: (amount: number) => string;
  onReportMismatch: () => void;
}

const StatementOverview: React.FC<StatementOverviewProps> = ({ analysisResult, balanceVerification, formatCurrency, onReportMismatch }) => {
  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">Statement Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
        <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Statement Period</p>
          <p className="text-xl font-semibold text-sky-600 dark:text-sky-400">{analysisResult.statementPeriod || 'N/A'}</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Opening Balance</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(analysisResult.openingBalance)}</p>
        </div>
         <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-xl">
          <p className="text-sm text-slate-500 dark:text-slate-400">Closing Balance (Statement)</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(analysisResult.closingBalance)}</p>
        </div>
        <div className={`p-4 rounded-xl ${balanceVerification?.isMatch ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <p className={`text-sm ${balanceVerification?.isMatch ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>Verification Status</p>
           {balanceVerification?.isMatch ? (
              <div className="flex items-center justify-center gap-2 text-xl font-semibold text-green-700 dark:text-green-300">
                <CheckCircle2 className="w-6 h-6" />
                <span>Balances Match</span>
              </div>
            ) : (
               <div className="flex items-center justify-center gap-2 text-xl font-semibold text-red-700 dark:text-red-300">
                 <XCircle className="w-6 h-6" />
                <span>Mismatch Found</span>
              </div>
            )}
        </div>
      </div>
       {balanceVerification && !balanceVerification.isMatch && (
        <div className="mt-4 bg-red-500/20 border border-red-500/40 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
          <div>
            <p><strong className="font-bold">Details:</strong> Calculated Closing Balance ({formatCurrency(balanceVerification.calculatedClosing)}) does not match the Statement Closing Balance by a difference of {formatCurrency(balanceVerification.difference)}.</p>
          </div>
          <button
            onClick={onReportMismatch}
            className="ml-4 flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-yellow-500 dark:border-yellow-400 text-sm font-medium rounded-md shadow-sm text-yellow-800 dark:text-yellow-200 bg-yellow-500/30 hover:bg-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
          >
            <MessageSquareWarning className="w-4 h-4 mr-2" />
            Report
          </button>
        </div>
      )}
    </div>
  );
};

export default StatementOverview;
