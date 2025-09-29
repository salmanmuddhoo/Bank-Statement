/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface ClientTransaction {
  clientName: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string; // e.g., "YYYY-MM-DD"
}

export interface ClientSummary {
  clientName: string;
  totalCredit: number;
  creditCount: number;
  totalDebit: number;
  debitCount: number;
  netTotal: number;
}

export interface ClientMonthlyTrend {
  clientName: string;
  month: string; // e.g., "2024-07"
  totalCredit: number;
  totalDebit: number;
  netChange: number;
}

export interface AnalysisResult {
  transactions: ClientTransaction[];
  openingBalance: number;
  closingBalance: number;
  statementPeriod: string;
}

export interface ExpectedPayment {
  clientName: string;
  amount: number;
  [key: string]: any; // To allow for additional columns from the Excel file
}

export interface PaymentStatus {
  clientName:string;
  expectedAmount: number;
  paidAmount: number;
  status: 'Paid' | 'Not Paid' | 'Partial Payment' | 'Payment Exceeded';
  difference: number;
  [key: string]: any; // To allow for additional data from expected payments
}