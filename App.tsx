/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ClientTransaction, ClientSummary, ClientMonthlyTrend, AnalysisResult } from './types';
import { analyzeStatement } from './services/geminiService';
import { Download, FileText, Loader2, UploadCloud, X, ArrowUpDown, BarChart, CheckCircle2, XCircle, Search } from 'lucide-react';

// Configure the PDF.js worker source from a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs`;

interface PdfTextItem {
  str: string;
}

type SortKey = keyof ClientMonthlyTrend;

const App: React.FC = () => {
  const [statementText, setStatementText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<ClientMonthlyTrend[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'month', direction: 'descending' });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Analyzing...');
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MU', {
      style: 'currency',
      currency: 'MUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const processAnalysis = (transactions: ClientTransaction[]) => {
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
    setClientSummaries(Object.values(summaryMap).sort((a, b) => a.clientName.localeCompare(b.clientName)));

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
    setMonthlyTrends(Object.values(trendMap));
  };

  const handleAnalyze = async () => {
    if (!statementText.trim()) {
      setError('Please provide a bank statement.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setClientSummaries([]);
    setMonthlyTrends([]);
    setAnalysisResult(null);
    setSearchQuery(''); // Reset search on new analysis

    try {
      // Step 1: Extract and normalize transactions in one call
      setLoadingMessage('Analyzing statement...');
      const result = await analyzeStatement(statementText);
      setAnalysisResult(result);

      if (result.transactions.length === 0) {
        setError("No client transactions were identified in the provided text.");
        setIsLoading(false);
        return;
      }

      // Step 2: Process the already-normalized transactions
      processAnalysis(result.transactions);

    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred during analysis.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsParsingPdf(true);
      setFileName(file.name);
      setStatementText('');
      setError(null);
      setClientSummaries([]);
      setMonthlyTrends([]);
      setAnalysisResult(null);
      setSearchQuery('');
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => (item as PdfTextItem).str).join(' ');
              fullText += pageText + '\n\n';
            }
            setStatementText(fullText);
          } catch (pdfError) {
            setError('Failed to parse the PDF file. It might be corrupted or in an unsupported format.');
          } finally {
            setIsParsingPdf(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        setError('Failed to read the file.');
        setIsParsingPdf(false);
      }
      event.target.value = ''; // Reset file input
    }
  };

  const clearFile = () => {
    setFileName(null);
    setStatementText('');
    setClientSummaries([]);
    setMonthlyTrends([]);
    setAnalysisResult(null);
    setError(null);
    setSearchQuery('');
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };
  
  const exportSummaryToCSV = () => {
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
    const dataToExport = sortedMonthlyTrends.map(t => ({
        "Client Name": t.clientName,
        "Month": t.month,
        "Total Credit": t.totalCredit,
        "Total Debit": t.totalDebit,
        "Net Change": t.netChange,
    }));
    exportToCSV(dataToExport, 'monthly_trends.csv');
  };

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

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
  
  const filteredGrandTotals = useMemo(() => {
    return filteredClientSummaries.reduce((acc, summary) => {
      acc.totalCredit += summary.totalCredit;
      acc.totalDebit += summary.totalDebit;
      acc.netTotal += summary.netTotal;
      return acc;
    }, { totalCredit: 0, totalDebit: 0, netTotal: 0 });
  }, [filteredClientSummaries]);

  const fullGrandTotals = useMemo(() => {
    return clientSummaries.reduce((acc, summary) => {
      acc.totalCredit += summary.totalCredit;
      acc.totalDebit += summary.totalDebit;
      return acc;
    }, { totalCredit: 0, totalDebit: 0 });
  }, [clientSummaries]);

  const balanceVerification = useMemo(() => {
    if (!analysisResult) return null;
    const calculatedClosing = analysisResult.openingBalance + fullGrandTotals.totalCredit - fullGrandTotals.totalDebit;
    const difference = calculatedClosing - analysisResult.closingBalance;
    const isMatch = Math.abs(difference) < 0.01; // Using a tolerance for floating point comparison
    return {
      calculatedClosing,
      difference,
      isMatch,
    };
  }, [analysisResult, fullGrandTotals]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-3">
            <FileText className="w-10 h-10 text-cyan-400" />
            <span>AI Bank Statement Analyzer</span>
          </h1>
          <p className="text-gray-400 mt-2">Upload or paste a bank statement to analyze client payment trends.</p>
        </header>

        <main className="space-y-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="statement-input" className="block text-lg font-medium text-gray-300 mb-2">
                  Paste Bank Statement
                </label>
                <textarea
                  id="statement-input"
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  placeholder="Paste your bank statement text here..."
                  className="w-full h-64 bg-gray-900 text-gray-300 border border-gray-700 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200 resize-none"
                  readOnly={!!fileName}
                />
              </div>
              <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg p-6 border-2 border-dashed border-gray-700">
                {fileName ? (
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <p className="font-semibold text-white">{fileName}</p>
                    {isParsingPdf && <p className="text-sm text-cyan-400 mt-2 animate-pulse">Parsing PDF...</p>}
                    <button
                      onClick={clearFile}
                      className="mt-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-800"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </button>
                  </div>
                ) : (
                  <>
                    <label htmlFor="pdf-upload" className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800">
                      <UploadCloud className="w-5 h-5 mr-3" />
                      Upload PDF
                    </label>
                    <input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                    <p className="mt-4 text-sm text-gray-400">or paste text on the left</p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={handleAnalyze}
                disabled={isLoading || isParsingPdf || !statementText.trim()}
                className="w-full max-w-xs inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-800 transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    {loadingMessage}
                  </>
                ) : (
                  <>
                    <BarChart className="w-5 h-5 mr-3" />
                    Analyze Statement
                  </>
                )}
              </button>
            </div>
            {error && <p className="mt-4 text-center text-red-400">{error}</p>}
          </div>

          {analysisResult && clientSummaries.length > 0 && (
            <div className="space-y-8">
              {/* Statement Overview & Balance Verification */}
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <h2 className="text-2xl font-semibold text-white mb-4">Statement Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Statement Period</p>
                    <p className="text-xl font-semibold text-cyan-400">{analysisResult.statementPeriod || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Opening Balance</p>
                    <p className="text-xl font-semibold text-white">{formatCurrency(analysisResult.openingBalance)}</p>
                  </div>
                   <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Closing Balance (Statement)</p>
                    <p className="text-xl font-semibold text-white">{formatCurrency(analysisResult.closingBalance)}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${balanceVerification?.isMatch ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
                    <p className={`text-sm ${balanceVerification?.isMatch ? 'text-green-300' : 'text-red-300'}`}>Verification Status</p>
                     {balanceVerification?.isMatch ? (
                        <div className="flex items-center justify-center gap-2 text-xl font-semibold text-green-400">
                          <CheckCircle2 className="w-6 h-6" />
                          <span>Balances Match</span>
                        </div>
                      ) : (
                         <div className="flex items-center justify-center gap-2 text-xl font-semibold text-red-400">
                           <XCircle className="w-6 h-6" />
                          <span>Mismatch Found</span>
                        </div>
                      )}
                  </div>
                </div>
                 {balanceVerification && !balanceVerification.isMatch && (
                  <div className="mt-4 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                    <p><strong className="font-bold">Details:</strong> Calculated Closing Balance ({formatCurrency(balanceVerification.calculatedClosing)}) does not match the Statement Closing Balance by a difference of {formatCurrency(balanceVerification.difference)}.</p>
                  </div>
                )}
              </div>
              
              {/* Search Bar */}
              <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by client name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-900 text-gray-300 border border-gray-700 rounded-md p-3 pl-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition duration-200"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>


              {/* Client Summary Card */}
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-white">Client Summary</h2>
                    <button 
                        onClick={exportSummaryToCSV}
                        disabled={filteredClientSummaries.length === 0}
                        className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Client Name</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Total Credit</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"># Credits</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Total Debit</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider"># Debits</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Net Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {filteredClientSummaries.length > 0 ? filteredClientSummaries.map((summary) => (
                                <tr key={summary.clientName}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{summary.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 text-right">{formatCurrency(summary.totalCredit)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{summary.creditCount}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 text-right">{formatCurrency(summary.totalDebit)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">{summary.debitCount}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${summary.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(summary.netTotal)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">No matching clients found.</td>
                                </tr>
                            )}
                        </tbody>
                        {filteredClientSummaries.length > 0 && (
                          <tfoot className="bg-gray-900">
                              <tr>
                                  <td className="px-6 py-3 text-left text-sm font-bold text-white uppercase">Grand Total (Filtered)</td>
                                  <td className="px-6 py-3 text-right text-sm font-bold text-green-400">{formatCurrency(filteredGrandTotals.totalCredit)}</td>
                                  <td colSpan={2} className="px-6 py-3 text-right text-sm font-bold text-red-400">{formatCurrency(filteredGrandTotals.totalDebit)}</td>
                                  <td colSpan={2} className={`px-6 py-3 text-right text-sm font-bold ${filteredGrandTotals.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(filteredGrandTotals.netTotal)}</td>
                              </tr>
                          </tfoot>
                        )}
                    </table>
                </div>
              </div>

              {/* Monthly Trends Card */}
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-white">Monthly Payment Trends</h2>
                     <button 
                        onClick={exportTrendsToCSV}
                        disabled={sortedMonthlyTrends.length === 0}
                        className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900">
                            <tr>
                                {(['clientName', 'month', 'totalCredit', 'totalDebit', 'netChange'] as SortKey[]).map(key => (
                                    <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        <button onClick={() => requestSort(key)} className="flex items-center gap-2 hover:text-white">
                                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                            <ArrowUpDown className="w-3 h-3 text-gray-500" />
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {sortedMonthlyTrends.length > 0 ? sortedMonthlyTrends.map((trend) => (
                                <tr key={`${trend.clientName}-${trend.month}`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{trend.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{trend.month}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 text-right">{formatCurrency(trend.totalCredit)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 text-right">{formatCurrency(trend.totalDebit)}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold text-right ${trend.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(trend.netChange)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-400">No matching trends found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
