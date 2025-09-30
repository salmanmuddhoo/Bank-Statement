/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import * as XLSX from 'xlsx';
import { PaymentStatus } from '../types.ts';
import { Download } from './Icons.tsx';

interface PaymentStatusTableProps {
  statuses: PaymentStatus[];
  activeFilter: PaymentStatus['status'] | 'All';
}

const getStatusColor = (status: PaymentStatus['status']) => {
  switch (status) {
    case 'Paid':
      return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
    case 'Not Paid':
      return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
    case 'Partial Payment':
      return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400';
    case 'Payment Exceeded':
      return 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-400';
    default:
      return '';
  }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MU', {
      style: 'currency',
      currency: 'MUR',
      minimumFractionDigits: 2,
    }).format(amount);
};

const PaymentStatusTable: React.FC<PaymentStatusTableProps> = ({ statuses, activeFilter }) => {

  const knownColumns = new Set(['clientName', 'expectedAmount', 'paidAmount', 'status', 'difference', 'paymentDate']);
  const extraColumns = statuses.length > 0 
    ? Object.keys(statuses[0]).filter(key => !knownColumns.has(key)) 
    : [];

  const formatHeader = (header: string) => {
    if (!header) return '';
    // Add space before uppercase letters
    const spaced = header.replace(/([A-Z])/g, ' $1');
    // Capitalize first letter
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  const onExport = () => {
    console.log(`[PaymentStatusTable] Exporting ${statuses.length} records for filter '${activeFilter}' to CSV.`);
    if (statuses.length === 0) return;

    const dataToExport = statuses.map(s => {
      const row: {[key: string]: any} = {
        "Client Name": s.clientName,
      };

      extraColumns.forEach(col => {
        row[formatHeader(col)] = s[col];
      });

      row["Expected Amount"] = s.expectedAmount;
      row["Paid Amount"] = s.paidAmount;
      row["Payment Date"] = s.paymentDate || 'N/A';
      row["Status"] = s.status;
      row["Difference"] = s.difference;
      
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment Status");
    const filename = `payment_status_${activeFilter.toLowerCase().replace(/ /g, '_')}_summary.csv`;
    XLSX.writeFile(wb, filename);
  };

  const fullColSpan = 7 + extraColumns.length;
  const exportButtonText = activeFilter === 'All' ? 'Export Reconciliation' : `Export "${activeFilter}"`;

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Payment Reconciliation {activeFilter !== 'All' && <span className="text-lg text-slate-500 dark:text-slate-400">({activeFilter})</span>}
          </h2>
          <button 
              onClick={onExport}
              disabled={statuses.length === 0}
              className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-50"
          >
              <Download className="w-4 h-4 mr-2" />
              {exportButtonText}
          </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client Name</th>
              {extraColumns.map(col => (
                <th key={col} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {formatHeader(col)}
                </th>
              ))}
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expected Amount</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paid Amount</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payment Date</th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {statuses.length > 0 ? (
              statuses.map((s) => (
                <tr key={s.clientName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">{s.clientName}</td>
                  {extraColumns.map(col => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      {s[col]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 text-right font-mono">{formatCurrency(s.expectedAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 text-right font-mono">{formatCurrency(s.paidAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 text-center font-mono">{s.paymentDate || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(s.status)}`}>
                          {s.status}
                      </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${s.difference === 0 ? 'text-slate-600 dark:text-slate-300' : s.difference > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-orange-600 dark:text-orange-400'}`}>{formatCurrency(s.difference)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={fullColSpan} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                  No records match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentStatusTable;