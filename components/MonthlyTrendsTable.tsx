/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ClientMonthlyTrend } from '../types.ts';
import { Download, ArrowUpDown } from './Icons.tsx';

type SortKey = keyof ClientMonthlyTrend;

interface MonthlyTrendsTableProps {
  trends: ClientMonthlyTrend[];
  sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null;
  requestSort: (key: SortKey) => void;
  formatCurrency: (amount: number) => string;
  onExport: () => void;
}

const SortableHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  sortConfig: { key: SortKey; direction: 'ascending' | 'descending' } | null;
  requestSort: (key: SortKey) => void;
  className?: string;
}> = ({ label, sortKey, sortConfig, requestSort, className = "" }) => (
    <th scope="col" className={`px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer ${className}`} onClick={() => requestSort(sortKey)}>
        <div className={`flex items-center ${className.includes('text-right') ? 'justify-end' : ''}`}>
            {label}
            {sortConfig?.key === sortKey && <ArrowUpDown className="w-4 h-4 ml-1" />}
        </div>
    </th>
);

const MonthlyTrendsTable: React.FC<MonthlyTrendsTableProps> = ({ trends, sortConfig, requestSort, formatCurrency, onExport }) => {
  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Monthly Trends</h2>
        <button 
          onClick={onExport}
          disabled={trends.length === 0}
          className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Trends
        </button>
      </div>
       <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <SortableHeader label="Client Name" sortKey="clientName" sortConfig={sortConfig} requestSort={requestSort} className="text-left" />
                <SortableHeader label="Month" sortKey="month" sortConfig={sortConfig} requestSort={requestSort} className="text-left" />
                <SortableHeader label="Total Credit" sortKey="totalCredit" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader label="Total Debit" sortKey="totalDebit" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader label="Net Change" sortKey="netChange" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {trends.map((trend, index) => (
                <tr key={`${trend.clientName}-${trend.month}-${index}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{trend.clientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{trend.month}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right font-mono">{formatCurrency(trend.totalCredit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-mono">{formatCurrency(trend.totalDebit)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${trend.netChange >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatCurrency(trend.netChange)}</td>
                </tr>
              ))}
            </tbody>
          </table>
       </div>
    </div>
  );
};

export default MonthlyTrendsTable;
