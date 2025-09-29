/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AnalysisResult, ClientTransaction, ClientSummary, ClientMonthlyTrend } from '../types.ts';
import StatementOverview from './StatementOverview.tsx';
import ClientSummaryTable from './ClientSummaryTable.tsx';
import MonthlyTrendsTable from './MonthlyTrendsTable.tsx';
import { Search, X } from './Icons.tsx';

type SortKey = keyof ClientMonthlyTrend;

interface ResultsDisplayProps {
  analysisResult: AnalysisResult;
  onOpenFeedbackModal: (data: any) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MU', {
    style: 'currency',
    currency: 'MUR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ analysisResult, onOpenFeedbackModal }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'month', direction: 'descending' });

  useEffect(() => {
    console.log("[ResultsDisplay] Component rendered with new analysis result.");
  }, [analysisResult]);

  useEffect(() => {
    console.log(`[ResultsDisplay] Search query changed to: '${searchQuery}'`);
  }, [searchQuery]);

  useEffect(() => {
    if (sortConfig) {
      console.log(`[ResultsDisplay] Sort config changed to: key='${sortConfig.key}', direction='${sortConfig.direction}'`);
    } else {
      console.log(`[ResultsDisplay] Sort config cleared.`);
    }
  }, [sortConfig]);

  const { clientSummaries, monthlyTrends } = useMemo(() => {
    console.log("[ResultsDisplay] Recalculating client summaries and monthly trends...");
    const transactions = analysisResult.transactions;
    // 1. Calculate aggregated summary per client
    const summaryMap: { [key: string]: ClientSummary } = {};
    for (const t of transactions) {
      if (!summaryMap[t.clientName]) {
        summaryMap[t.clientName] = { clientName: t.clientName, totalCredit: 0, creditCount: 0, totalDebit: 0, debitCount: 0, netTotal: 0 };
      }
      if (t.type === 'credit') {
        summaryMap[t.clientName].totalCredit += t.amount;
        summaryMap[t.clientName].creditCount += 1;
      } else {
        summaryMap[t.clientName].totalDebit += t.amount;
        summaryMap[t.clientName].debitCount += 1;
      }
      summaryMap[t.clientName].netTotal = summaryMap[t.clientName].totalCredit - summaryMap[t.clientName].totalDebit;
    }
    const summaries = Object.values(summaryMap).sort((a, b) => a.clientName.localeCompare(b.clientName));

    // 2. Calculate monthly trends
    const trendMap: { [key: string]: ClientMonthlyTrend } = {};
    for (const t of transactions) {
      if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue; // Skip if date is invalid
      const month = t.date.substring(0, 7); // YYYY-MM
      const key = `${t.clientName}|${month}`;
      if (!trendMap[key]) {
        trendMap[key] = { clientName: t.clientName, month, totalCredit: 0, totalDebit: 0, netChange: 0 };
      }
      if (t.type === 'credit') {
        trendMap[key].totalCredit += t.amount;
      } else {
        trendMap[key].totalDebit += t.amount;
      }
      trendMap[key].netChange = trendMap[key].totalCredit - trendMap[key].totalDebit;
    }
    const trends = Object.values(trendMap);

    console.log(`[ResultsDisplay] Calculation complete. Found ${summaries.length} unique clients and ${trends.length} trend entries.`);
    return { clientSummaries: summaries, monthlyTrends: trends };
  }, [analysisResult]);

  const filteredClientSummaries = useMemo(() => {
    if (!searchQuery) return clientSummaries;
    return clientSummaries.filter(summary =>
      summary.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clientSummaries, searchQuery]);

  const filteredMonthlyTrends = useMemo(() => {
    if (!searchQuery) return monthlyTrends;
    return monthlyTrends.filter(trend =>
      trend.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [monthlyTrends, searchQuery]);

  const sortedMonthlyTrends = useMemo(() => {
    let sortableItems = [...filteredMonthlyTrends];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredMonthlyTrends, sortConfig]);

  const fullGrandTotals = useMemo(() => {
    return clientSummaries.reduce((acc, summary) => {
      acc.totalCredit += summary.totalCredit;
      acc.totalDebit += summary.totalDebit;
      return acc;
    }, { totalCredit: 0, totalDebit: 0 });
  }, [clientSummaries]);
  
  const filteredGrandTotals = useMemo(() => {
    return filteredClientSummaries.reduce((acc, summary) => {
      acc.totalCredit += summary.totalCredit;
      acc.creditCount += summary.creditCount;
      acc.totalDebit += summary.totalDebit;
      acc.debitCount += summary.debitCount;
      acc.netTotal += summary.netTotal;
      return acc;
    }, { totalCredit: 0, creditCount: 0, totalDebit: 0, debitCount: 0, netTotal: 0 });
  }, [filteredClientSummaries]);

  const balanceVerification = useMemo(() => {
    console.log("[ResultsDisplay] Performing balance verification...");
    if (!analysisResult) return null;
    const calculatedClosing = analysisResult.openingBalance + fullGrandTotals.totalCredit - fullGrandTotals.totalDebit;
    const difference = calculatedClosing - analysisResult.closingBalance;
    const isMatch = Math.abs(difference) < 0.01; // Using a tolerance for floating point comparison
    console.log(`[ResultsDisplay] Balance verification complete. Match: ${isMatch}, Difference: ${difference}`);
    return { calculatedClosing, difference, isMatch };
  }, [analysisResult, fullGrandTotals]);

  const handleOpenFeedbackModal = () => {
    if (!analysisResult) return;
    onOpenFeedbackModal({
      openingBalance: String(analysisResult.openingBalance),
      closingBalance: String(analysisResult.closingBalance),
      totalCredit: String(fullGrandTotals.totalCredit),
      totalDebit: String(fullGrandTotals.totalDebit),
      notes: ''
    });
  };

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    console.log(`[ResultsDisplay] Requesting sort for key: '${key}'. New direction will be '${direction}'.`);
    setSortConfig({ key, direction });
  };
  
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename);
  };
  
  const exportSummaryToCSV = () => {
    console.log("[ResultsDisplay] Exporting client summary to CSV.");
    const dataToExport = filteredClientSummaries.map(s => ({
        "Client Name": s.clientName,
        "Total Credit": s.totalCredit,
        "Credit Count": s.creditCount,
        "Total Debit": s.totalDebit,
        "Debit Count": s.debitCount,
        "Net Total": s.netTotal,
    }));
    exportToCSV(dataToExport, 'client_summary.csv');
  };

  const exportTrendsToCSV = () => {
    console.log("[ResultsDisplay] Exporting monthly trends to CSV.");
    const dataToExport = sortedMonthlyTrends.map(t => ({
        "Client Name": t.clientName,
        "Month": t.month,
        "Total Credit": t.totalCredit,
        "Total Debit": t.totalDebit,
        "Net Change": t.netChange,
    }));
    exportToCSV(dataToExport, 'monthly_trends.csv');
  };
  
  if (analysisResult.transactions.length === 0) {
      console.log("[ResultsDisplay] No transactions to display. Rendering only the overview.");
      return (
          <StatementOverview
            analysisResult={analysisResult}
            balanceVerification={balanceVerification}
            formatCurrency={formatCurrency}
            onReportMismatch={handleOpenFeedbackModal}
          />
      );
  }

  return (
    <div className="space-y-8">
      <StatementOverview
        analysisResult={analysisResult}
        balanceVerification={balanceVerification}
        formatCurrency={formatCurrency}
        onReportMismatch={handleOpenFeedbackModal}
      />
      
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-xl">
        <div className="relative">
          <input
            type="text"
            placeholder="Search by client name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-3 pl-10 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 dark:text-slate-500 dark:hover:text-white">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <ClientSummaryTable 
        summaries={filteredClientSummaries}
        totals={filteredGrandTotals}
        searchQuery={searchQuery}
        formatCurrency={formatCurrency}
        onExport={exportSummaryToCSV}
      />

      <MonthlyTrendsTable 
        trends={sortedMonthlyTrends}
        sortConfig={sortConfig}
        requestSort={requestSort}
        formatCurrency={formatCurrency}
        onExport={exportTrendsToCSV}
      />
    </div>
  );
};

export default ResultsDisplay;
