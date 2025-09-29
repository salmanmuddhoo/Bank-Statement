/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { AnalysisResult, ClientTransaction, ClientSummary, ClientMonthlyTrend, ExpectedPayment, PaymentStatus } from './types.ts';
import { analyzeStatement } from './services/geminiService.ts';
import ApiKeyModal from './components/ApiKeyModal.tsx';
import FeedbackModal from './components/FeedbackModal.tsx';
import Header from './components/Header.tsx';
import StatementInput from './components/StatementInput.tsx';
import AnalysisProgress from './components/AnalysisProgress.tsx';
import ResultsDisplay from './components/ResultsDisplay.tsx';
import NavigationView from './components/NavigationView.tsx';
import DashboardView from './components/DashboardView.tsx';

// Configure the PDF.js worker source from a CDN, with a safeguard
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.mjs`;
}


interface PdfTextItem {
  str: string;
}

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const [statementText, setStatementText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ step: number; total: number; message: string } | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [feedbackForm, setFeedbackForm] = useState({
    openingBalance: '',
    closingBalance: '',
    totalCredit: '',
    totalDebit: '',
    notes: ''
  });

  const [activeView, setActiveView] = useState<'analyzer' | 'dashboard'>('analyzer');

  // State for expected payments file
  const [paymentsFileName, setPaymentsFileName] = useState<string | null>(null);
  const [isParsingPaymentsFile, setIsParsingPaymentsFile] = useState<boolean>(false);
  const [expectedPayments, setExpectedPayments] = useState<ExpectedPayment[] | null>(null);

  // State for derived data
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[] | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<ClientMonthlyTrend[] | null>(null);
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[] | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'dark'; // Default theme
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    console.log("[App] Component mounted. Checking for API key...");
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
      console.log("[App] Found API key in local storage.");
      setApiKey(storedApiKey);
      setTempApiKey(storedApiKey);
    } else {
      console.warn("[App] No API key found. Opening API key modal.");
      setIsApiKeyModalOpen(true);
    }
  }, []);

  useEffect(() => {
    console.log(`[App] Switched to '${activeView}' view.`);
  }, [activeView]);

  const handleSaveApiKey = () => {
    console.log("[App] Attempting to save API key...");
    if (!tempApiKey.trim()) {
      setApiKeyError('API Key cannot be empty.');
      console.error("[App] API key save failed: Key is empty.");
      return;
    }
    setApiKey(tempApiKey);
    localStorage.setItem('gemini-api-key', tempApiKey);
    setIsApiKeyModalOpen(false);
    setApiKeyError(null);
    console.log("[App] API key saved successfully.");
  };

  const calculateSummariesAndTrends = (transactions: ClientTransaction[]) => {
    console.log("[App] Recalculating client summaries and monthly trends...");
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

    console.log(`[App] Calculation complete. Found ${summaries.length} unique clients and ${trends.length} trend entries.`);
    return { summaries, trends };
  }

  const reconcilePayments = (summaries: ClientSummary[], expected: ExpectedPayment[]): PaymentStatus[] => {
    console.log('[App] Starting payment reconciliation...');
    const summaryMap = new Map<string, ClientSummary>();
    summaries.forEach(s => summaryMap.set(s.clientName.toLowerCase().trim(), s));
  
    const statuses: PaymentStatus[] = expected.map(exp => {
      const clientNameLower = exp.clientName.toLowerCase().trim();
      const summary = summaryMap.get(clientNameLower);
      const paidAmount = summary?.totalCredit ?? 0;
      const difference = paidAmount - exp.amount;
  
      let status: PaymentStatus['status'];
      if (paidAmount === 0) {
        status = 'Not Paid';
      } else if (Math.abs(difference) < 0.01) { // Tolerance for floating point
        status = 'Paid';
      } else if (difference < 0) {
        status = 'Partial Payment';
      } else { // difference > 0
        status = 'Payment Exceeded';
      }
      
      const { clientName, amount, ...extraData } = exp;

      return {
        ...extraData,
        clientName: exp.clientName,
        expectedAmount: exp.amount,
        paidAmount,
        status,
        difference,
      };
    });
    
    console.log(`[App] Reconciliation complete. Processed ${statuses.length} expected payments.`);
    return statuses;
  };

  const handleAnalyze = async () => {
    console.log("[App] 'Analyze' button clicked.");
    if (!statementText.trim()) {
      setError('Please provide a bank statement.');
      console.warn("[App] Analysis blocked: Statement text is empty.");
      return;
    }
    if (!apiKey) {
      setError('Gemini API Key is not set. Please set it in the settings.');
      setIsApiKeyModalOpen(true);
      console.warn("[App] Analysis blocked: API key is not set.");
      return;
    }
  
    console.info("[App] Starting analysis process...");
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setClientSummaries(null);
    setMonthlyTrends(null);
    setPaymentStatuses(null);
    setProgress(null);
    // Switch back to analyzer view on new analysis
    setActiveView('analyzer');
  
    const TOTAL_STEPS = 7;
  
    try {
      setProgress({ step: 1, total: TOTAL_STEPS, message: 'Initializing Secure Connection...' });
      await new Promise(resolve => setTimeout(resolve, 300));
  
      setProgress({ step: 2, total: TOTAL_STEPS, message: 'Sending statement to Gemini AI...' });
      const analysisPromise = analyzeStatement(statementText, apiKey);
  
      // Simulate progress
      setTimeout(() => setProgress(p => p && p.step < 3 ? { step: 3, total: TOTAL_STEPS, message: 'AI: Parsing statement structure...' } : p), 1500);
      setTimeout(() => setProgress(p => p && p.step < 4 ? { step: 4, total: TOTAL_STEPS, message: 'AI: Extracting & normalizing transactions...' } : p), 4000);
      setTimeout(() => setProgress(p => p && p.step < 5 ? { step: 5, total: TOTAL_STEPS, message: 'AI: Performing balance verification...' } : p), 7000);
  
      const result = await analysisPromise;
      
      console.log("[App] Analysis successful. Received result:", result);
  
      setProgress({ step: 6, total: TOTAL_STEPS, message: 'Receiving & parsing AI response...' });
      await new Promise(resolve => setTimeout(resolve, 500));
  
      if (result.transactions.length === 0) {
        setError("No client transactions were identified in the provided text.");
        console.warn("[App] Analysis complete, but no transactions found.");
      }
      
      setAnalysisResult(result);
      const { summaries, trends } = calculateSummariesAndTrends(result.transactions);
      setClientSummaries(summaries);
      setMonthlyTrends(trends);

      if (expectedPayments && summaries.length > 0) {
        const statuses = reconcilePayments(summaries, expectedPayments);
        setPaymentStatuses(statuses);
      }
  
      setProgress({ step: 7, total: TOTAL_STEPS, message: 'Generating client summaries & trends...' });
      await new Promise(resolve => setTimeout(resolve, 500));
  
      console.info("[App] Analysis process completed successfully.");
    } catch (error) {
      console.error("[App] An error occurred during analysis:", error);
      if (error instanceof Error) {
        if (error.message.includes('API key not valid')) {
          setError('Your Gemini API key is invalid. Please correct it.');
          setApiKeyError('Your Gemini API key is invalid. Please correct it.');
          setIsApiKeyModalOpen(true);
        } else {
          setError(error.message);
        }
      } else {
        setError('An unknown error occurred during analysis.');
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      console.log("[App] Analysis process finished (finally block).");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log(`[App] File selected: '${file.name}', type: '${file.type}'`);
      setIsParsingFile(true);
      setFileName(file.name);
      setStatementText('');
      setError(null);
      setAnalysisResult(null);
      setClientSummaries(null);
      setMonthlyTrends(null);
      setPaymentStatuses(null);
      setActiveView('analyzer');
  
      const reader = new FileReader();
      const fileNameLower = file.name.toLowerCase();
  
      const parsePdf = async (fileData: ArrayBuffer) => {
        const typedArray = new Uint8Array(fileData);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => (item as PdfTextItem).str).join(' ') + '\n\n';
        }
        return fullText;
      };

      const parseExcel = (fileData: ArrayBuffer) => {
        const workbook = XLSX.read(fileData, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("The Excel file is empty or contains no sheets.");
        const worksheet = workbook.Sheets[firstSheetName];
        return XLSX.utils.sheet_to_csv(worksheet);
      };

      try {
        console.log(`[App] Starting to parse file '${file.name}'.`);
        if (file.type === 'application/pdf') {
          const fileData = await file.arrayBuffer();
          setStatementText(await parsePdf(fileData));
        } else if (file.type === 'text/csv' || fileNameLower.endsWith('.csv')) {
          setStatementText(await file.text());
        } else if (
          fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.xlsx') ||
          file.type === 'application/vnd.ms-excel' ||
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ) {
          const fileData = await file.arrayBuffer();
          setStatementText(parseExcel(fileData));
        } else {
          throw new Error('Unsupported file type. Please upload a PDF, CSV, or Excel file.');
        }
        console.log(`[App] Successfully parsed file '${file.name}'.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred during parsing.';
        setError(`Failed to parse the file. Details: ${message}`);
        setFileName(null);
        console.error(`[App] Failed to parse file '${file.name}'. Error:`, err);
      } finally {
        setIsParsingFile(false);
        console.log(`[App] File parsing process finished for '${file.name}'.`);
      }
  
      event.target.value = ''; // Reset file input
    }
  };

  const handlePaymentsFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log(`[App] Payments file selected: '${file.name}'`);
      setIsParsingPaymentsFile(true);
      setPaymentsFileName(file.name);
      setExpectedPayments(null);
      setPaymentStatuses(null); // Clear previous statuses
      setError(null);

      const parsePaymentsExcel = (fileData: ArrayBuffer): ExpectedPayment[] => {
        const workbook = XLSX.read(fileData, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("The payments Excel file is empty or contains no sheets.");
        const worksheet = workbook.Sheets[firstSheetName];
        const data: any[] = XLSX.utils.sheet_to_json(worksheet);
      
        if (data.length === 0) return [];

        // Dynamically find header names for flexibility
        const header = Object.keys(data[0] || {});
        const nameHeader = header.find(h => h.toLowerCase().includes('name'));
        const amountHeader = header.find(h => h.toLowerCase().includes('amount'));
      
        if (!nameHeader || !amountHeader) {
          throw new Error("Excel file must contain columns with 'Name' and 'Amount' in their headers.");
        }
        
        return data
          .map(row => {
            const clientName = String(row[nameHeader]).trim();
            const amount = parseFloat(row[amountHeader]);
            
            // Create a new object with all other properties
            const extraData: { [key: string]: any } = {};
            for (const key in row) {
              if (key !== nameHeader && key !== amountHeader) {
                extraData[key] = row[key];
              }
            }

            return {
              ...extraData,
              clientName,
              amount,
            };
          })
          .filter(p => p.clientName && !isNaN(p.amount) && p.amount > 0);
      };

      try {
        const fileData = await file.arrayBuffer();
        const payments = parsePaymentsExcel(fileData);
        setExpectedPayments(payments);
        console.log(`[App] Successfully parsed payments file. Found ${payments.length} expected payments.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred during parsing.';
        setError(`Failed to parse payments file. Details: ${message}`);
        setPaymentsFileName(null);
        console.error(`[App] Failed to parse payments file '${file.name}'. Error:`, err);
      } finally {
        setIsParsingPaymentsFile(false);
      }
      event.target.value = ''; // Reset file input
    }
  }

  const clearFile = () => {
    console.log("[App] Clearing uploaded file and statement text.");
    setFileName(null);
    setStatementText('');
    setAnalysisResult(null);
    setError(null);
    setActiveView('analyzer');
    setClientSummaries(null);
    setMonthlyTrends(null);
    setPaymentStatuses(null);
    // Clearing statement should also clear payments file, as it depends on the statement
    clearPaymentsFile();
  };

  const clearPaymentsFile = () => {
    console.log("[App] Clearing payments file.");
    setPaymentsFileName(null);
    setExpectedPayments(null);
    setPaymentStatuses(null);
  };

  const handleFeedbackFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFeedbackForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitFeedback = () => {
      console.log("[App] Submitting feedback form.");
      console.log("--- AI Mismatch Feedback Submitted ---");
      console.log("This data would be sent to a backend for analysis.");
      console.log("Original Statement Text (snippet):", statementText.substring(0, 500) + "...");
      console.log("AI Analysis Result:", analysisResult);
      console.log("User Corrected Values:", feedbackForm);
      console.log("------------------------------------");
      
      alert("Thank you for your feedback! It will be used to improve the AI analysis.");
      setIsFeedbackModalOpen(false);
      console.log("[App] Feedback modal closed.");
  };
  
  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-300 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => { 
            console.log("[App] Closing API key modal.");
            setIsApiKeyModalOpen(false); 
            setApiKeyError(null); 
            setTempApiKey(apiKey); 
        }}
        onSave={handleSaveApiKey}
        tempApiKey={tempApiKey}
        setTempApiKey={setTempApiKey}
        error={apiKeyError}
        hasExistingKey={!!apiKey}
      />
      
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => {
            console.log("[App] Closing feedback modal.");
            setIsFeedbackModalOpen(false)
        }}
        onSubmit={handleSubmitFeedback}
        feedbackForm={feedbackForm}
        onFormChange={handleFeedbackFormChange}
      />

      <div className="w-full max-w-7xl">
        <Header 
          onSettingsClick={() => {
              console.log("[App] Settings icon clicked, opening API key modal.");
              setIsApiKeyModalOpen(true)
          }}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        
        <NavigationView activeView={activeView} setActiveView={setActiveView} hasAnalysis={!!analysisResult} />

        <main className="space-y-8 mt-8">
          {activeView === 'analyzer' && (
            <>
              <StatementInput
                statementText={statementText}
                onStatementChange={(e) => setStatementText(e.target.value)}
                handleFileChange={handleFileChange}
                fileName={fileName}
                isParsingFile={isParsingFile}
                clearFile={clearFile}
                handleAnalyze={handleAnalyze}
                isLoading={isLoading}
                apiKey={apiKey}
                paymentsFileName={paymentsFileName}
                isParsingPaymentsFile={isParsingPaymentsFile}
                handlePaymentsFileChange={handlePaymentsFileChange}
                clearPaymentsFile={clearPaymentsFile}
              />
              {error && <p className="mt-4 text-center text-red-600 dark:text-red-400">{error}</p>}

              {isLoading && <AnalysisProgress progress={progress} />}

              {!isLoading && analysisResult && clientSummaries && monthlyTrends && (
                <ResultsDisplay
                  analysisResult={analysisResult}
                  clientSummaries={clientSummaries}
                  monthlyTrends={monthlyTrends}
                  onOpenFeedbackModal={(data) => {
                    console.log("[App] Opening feedback modal from ResultsDisplay.");
                    setFeedbackForm(data);
                    setIsFeedbackModalOpen(true);
                  }}
                />
              )}
            </>
          )}
          
          {activeView === 'dashboard' && (
            <DashboardView analysisResult={analysisResult} paymentStatuses={paymentStatuses} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;