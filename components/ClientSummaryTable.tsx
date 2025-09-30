/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import { ClientSummary } from '../types.ts';
import { Download, ChevronDown } from './Icons.tsx';

interface ClientSummaryTableProps {
  summaries: ClientSummary[];
  totals: { totalCredit: number; creditCount: number; totalDebit: number; debitCount: number; netTotal: number };
  searchQuery: string;
  formatCurrency: (amount: number) => string;
  onExport: (type: 'full' | 'credits' | 'debits') => void;
}

const ClientSummaryTable: React.FC<ClientSummaryTableProps> = ({ summaries, totals, searchQuery, formatCurrency, onExport }) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Client Summary</h2>
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <div>
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={summaries.length === 0}
                className="inline-flex items-center justify-center w-full px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Summary
                <ChevronDown className="w-4 h-4 ml-2 -mr-1" />
              </button>
            </div>
    
            {isExportMenuOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 dark:ring-white/10 focus:outline-none z-10">
                <div className="py-1">
                  <button
                    onClick={() => { onExport('full'); setIsExportMenuOpen(false); }}
                    className="text-left w-full block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Export Full Summary
                  </button>
                  <button
                    onClick={() => { onExport('credits'); setIsExportMenuOpen(false); }}
                    className="text-left w-full block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Export Credits Only
                  </button>
                  <button
                    onClick={() => { onExport('debits'); setIsExportMenuOpen(false); }}
                    className="text-left w-full block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Export Debits Only
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client Name</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Credit</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Credit Count</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Debit</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Debit Count</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {summaries.map((summary) => (
              <tr key={summary.clientName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{summary.clientName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right font-mono">{formatCurrency(summary.totalCredit)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 text-center font-mono">{summary.creditCount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-mono">{formatCurrency(summary.totalDebit)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 text-center font-mono">{summary.debitCount}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${summary.netTotal >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatCurrency(summary.netTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 dark:bg-slate-800/50">
              <tr>
                  <th scope="row" className="px-6 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase">Totals {searchQuery && `(Filtered)`}</th>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-green-600 dark:text-green-300 font-mono">{formatCurrency(totals.totalCredit)}</td>
                  <td className="px-6 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono">{totals.creditCount}</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-red-600 dark:text-red-300 font-mono">{formatCurrency(totals.totalDebit)}</td>
                  <td className="px-6 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300 font-mono">{totals.debitCount}</td>
                  <td className={`px-6 py-3 text-right text-sm font-semibold font-mono ${totals.netTotal >= 0 ? 'text-sky-600 dark:text-sky-300' : 'text-orange-500 dark:text-orange-300'}`}>{formatCurrency(totals.netTotal)}</td>
              </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ClientSummaryTable;