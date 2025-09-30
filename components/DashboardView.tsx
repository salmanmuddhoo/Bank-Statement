/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo, useEffect, useState } from 'react';
import { AnalysisResult, ClientSummary, PaymentStatus } from '../types.ts';
import { BarChart2, ArrowUpRight, ArrowDownLeft, Users, LayoutDashboard, CheckCircle2, XCircle, AlertCircle, PlusCircle } from './Icons.tsx';
import PaymentStatusTable from './PaymentStatusTable.tsx';

interface DashboardViewProps {
  analysisResult: AnalysisResult | null;
  paymentStatuses: PaymentStatus[] | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-MU', {
    style: 'currency',
    currency: 'MUR',
    minimumFractionDigits: 2,
  }).format(amount);
};

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-slate-100 dark:bg-slate-800/40 p-6 rounded-xl flex items-center justify-between">
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">{value}</p>
        </div>
        <div className="bg-slate-200 dark:bg-slate-700/50 p-3 rounded-full">{icon}</div>
    </div>
);

const StatusFilterCard: React.FC<{
    title: string;
    count: number;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    activeClasses: string;
}> = ({ title, count, icon, isActive, onClick, activeClasses }) => (
    <button
        onClick={onClick}
        className={`p-4 rounded-xl text-left w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
            isActive
                ? `${activeClasses}`
                : 'bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800 border-2 border-transparent'
        }`}
    >
        <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
            {icon}
        </div>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-1">{count}</p>
    </button>
);


const DashboardView: React.FC<DashboardViewProps> = ({ analysisResult, paymentStatuses }) => {
    
    const [statusFilter, setStatusFilter] = useState<PaymentStatus['status'] | 'All'>('All');

    useEffect(() => {
        console.log("[DashboardView] Component mounted or analysisResult updated.");
    }, [analysisResult]);

    // Reset filter when data changes
    useEffect(() => {
        setStatusFilter('All');
    }, [paymentStatuses]);

    const statusCounts = useMemo(() => {
        if (!paymentStatuses) return { paid: 0, notPaid: 0, partial: 0, exceeded: 0, total: 0 };
        return paymentStatuses.reduce((acc, status) => {
            if (status.status === 'Paid') acc.paid++;
            else if (status.status === 'Not Paid') acc.notPaid++;
            else if (status.status === 'Partial Payment') acc.partial++;
            else if (status.status === 'Payment Exceeded') acc.exceeded++;
            acc.total++;
            return acc;
        }, { paid: 0, notPaid: 0, partial: 0, exceeded: 0, total: 0 });
    }, [paymentStatuses]);

    const filteredPaymentStatuses = useMemo(() => {
        if (!paymentStatuses) return null;
        if (statusFilter === 'All') return paymentStatuses;
        return paymentStatuses.filter(s => s.status === statusFilter);
    }, [paymentStatuses, statusFilter]);
    
    const paymentProgress = useMemo(() => {
        if (!paymentStatuses || paymentStatuses.length === 0) {
            return null;
        }
        const totalReceived = paymentStatuses.reduce((acc, curr) => acc + curr.paidAmount, 0);
        const totalExpected = paymentStatuses.reduce((acc, curr) => acc + curr.expectedAmount, 0);
        const progressPercentage = totalExpected > 0 ? (totalReceived / totalExpected) * 100 : 0;

        return {
            totalReceived,
            totalExpected,
            progressPercentage,
        };
    }, [paymentStatuses]);

    const dashboardData = useMemo(() => {
        if (!analysisResult) return null;
        console.log("[DashboardView] Recalculating dashboard data...");

        const transactions = analysisResult.transactions;
        let totalCreditAmount = 0;
        let totalDebitAmount = 0;
        let totalCreditCount = 0;
        let totalDebitCount = 0;
        
        const summaryMap: { [key: string]: ClientSummary } = {};
        const monthlyMap: { [month: string]: { credit: number; debit: number } } = {};

        for (const t of transactions) {
            // Aggregate totals
            if (t.type === 'credit') {
                totalCreditAmount += t.amount;
                totalCreditCount++;
            } else {
                totalDebitAmount += t.amount;
                totalDebitCount++;
            }

            // Aggregate client summaries
            if (!summaryMap[t.clientName]) {
                summaryMap[t.clientName] = { clientName: t.clientName, totalCredit: 0, creditCount: 0, totalDebit: 0, debitCount: 0, netTotal: 0 };
            }
            if (t.type === 'credit') {
                summaryMap[t.clientName].totalCredit += t.amount;
                summaryMap[t.clientName].creditCount++;
            } else {
                summaryMap[t.clientName].totalDebit += t.amount;
                summaryMap[t.clientName].debitCount++;
            }

            // Aggregate monthly trends
            if (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
                const month = t.date.substring(0, 7);
                if (!monthlyMap[month]) {
                    monthlyMap[month] = { credit: 0, debit: 0 };
                }
                if (t.type === 'credit') {
                    monthlyMap[month].credit += t.amount;
                } else {
                    monthlyMap[month].debit += t.amount;
                }
            }
        }
        
        // Finalize client summaries and sort for top movers
        Object.values(summaryMap).forEach(s => {
            s.netTotal = s.totalCredit - s.totalDebit;
        });
        const clientSummaries = Object.values(summaryMap);

        const topInflows = [...clientSummaries].sort((a, b) => b.netTotal - a.netTotal).slice(0, 5);
        const topOutflows = [...clientSummaries].sort((a, b) => a.netTotal - b.netTotal).slice(0, 5);

        // Finalize monthly trends
        const monthlyTrends = Object.entries(monthlyMap).map(([month, data]) => ({
            month,
            netChange: data.credit - data.debit,
        })).sort((a,b) => a.month.localeCompare(b.month));
        
        console.log("[DashboardView] Dashboard data calculation complete.");
        return {
            totalCreditAmount,
            totalDebitAmount,
            totalCreditCount,
            totalDebitCount,
            uniqueClients: clientSummaries.length,
            topInflows,
            topOutflows,
            monthlyTrends,
        };
    }, [analysisResult]);

    if (!analysisResult) {
        return (
            <div className="text-center py-20 bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl">
                <LayoutDashboard className="w-16 h-16 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-300">Dashboard is Empty</h2>
                <p className="text-slate-500 mt-2">Please go to the 'Analyzer' tab and analyze a bank statement to view reports.</p>
            </div>
        );
    }
    
    if (!dashboardData) return null; // Should not happen if analysisResult is present

    const maxNetChange = Math.max(...dashboardData.monthlyTrends.map(t => Math.abs(t.netChange)), 1);

    return (
        <div className="space-y-8">
            {/* Payment Status Section */}
            {paymentStatuses && paymentStatuses.length > 0 && (
                <div className="space-y-6">
                    {/* Status Filter Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <StatusFilterCard title="Total" count={statusCounts.total} icon={<Users className="w-6 h-6 text-slate-500 dark:text-slate-400" />} isActive={statusFilter === 'All'} onClick={() => setStatusFilter('All')} activeClasses="bg-slate-500/20 border-slate-500 dark:bg-slate-400/20 dark:border-slate-400 focus:ring-slate-500" />
                        <StatusFilterCard title="Paid" count={statusCounts.paid} icon={<CheckCircle2 className="w-6 h-6 text-green-500 dark:text-green-400" />} isActive={statusFilter === 'Paid'} onClick={() => setStatusFilter('Paid')} activeClasses="bg-green-500/20 border-green-500 dark:bg-green-500/20 dark:border-green-500 focus:ring-green-500" />
                        <StatusFilterCard title="Partial Payment" count={statusCounts.partial} icon={<AlertCircle className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />} isActive={statusFilter === 'Partial Payment'} onClick={() => setStatusFilter('Partial Payment')} activeClasses="bg-yellow-500/20 border-yellow-500 dark:bg-yellow-500/20 dark:border-yellow-500 focus:ring-yellow-500" />
                        <StatusFilterCard title="Payment Exceeded" count={statusCounts.exceeded} icon={<PlusCircle className="w-6 h-6 text-sky-500 dark:text-sky-400" />} isActive={statusFilter === 'Payment Exceeded'} onClick={() => setStatusFilter('Payment Exceeded')} activeClasses="bg-sky-500/20 border-sky-500 dark:bg-sky-500/20 dark:border-sky-500 focus:ring-sky-500" />
                        <StatusFilterCard title="Not Paid" count={statusCounts.notPaid} icon={<XCircle className="w-6 h-6 text-red-500 dark:text-red-400" />} isActive={statusFilter === 'Not Paid'} onClick={() => setStatusFilter('Not Paid')} activeClasses="bg-red-500/20 border-red-500 dark:bg-red-500/20 dark:border-red-500 focus:ring-red-500" />
                    </div>

                    {/* Overall Payment Progress */}
                    {paymentProgress && (
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                                Overall Payment Progress
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        Total Received: <span className="font-mono text-green-600 dark:text-green-400">{formatCurrency(paymentProgress.totalReceived)}</span>
                                    </span>
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        Expected: <span className="font-mono">{formatCurrency(paymentProgress.totalExpected)}</span>
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-4 relative overflow-hidden">
                                    <div
                                        className="bg-sky-500 h-4 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${Math.min(paymentProgress.progressPercentage, 100)}%` }}
                                    ></div>
                                    {paymentProgress.progressPercentage > 100 && (
                                        <div
                                            className="absolute top-0 bg-yellow-400 h-4 rounded-r-full"
                                            style={{ left: '100%', width: `${paymentProgress.progressPercentage - 100}%` }}
                                        ></div>
                                    )}
                                     <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white z-10" style={{ textShadow: '0 0 3px rgba(0,0,0,0.5)' }}>
                                        {paymentProgress.progressPercentage.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {filteredPaymentStatuses && <PaymentStatusTable statuses={filteredPaymentStatuses} activeFilter={statusFilter} />}
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Credits" value={formatCurrency(dashboardData.totalCreditAmount)} icon={<ArrowUpRight className="w-6 h-6 text-green-500 dark:text-green-400" />} />
                <StatCard title="Total Debits" value={formatCurrency(dashboardData.totalDebitAmount)} icon={<ArrowDownLeft className="w-6 h-6 text-red-500 dark:text-red-400" />} />
                <StatCard title="Credit Transactions" value={dashboardData.totalCreditCount.toLocaleString()} icon={<ArrowUpRight className="w-6 h-6 text-green-500 dark:text-green-400" />} />
                <StatCard title="Debit Transactions" value={dashboardData.totalDebitCount.toLocaleString()} icon={<ArrowDownLeft className="w-6 h-6 text-red-500 dark:text-red-400" />} />
            </div>

            {/* Monthly Net Change Chart */}
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><BarChart2 className="w-6 h-6 text-sky-500 dark:text-sky-400" /> Monthly Net Change</h2>
                <div className="space-y-4">
                    {dashboardData.monthlyTrends.map(trend => (
                        <div key={trend.month} className="grid grid-cols-4 items-center gap-4">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{trend.month}</span>
                            <div className="col-span-3 bg-slate-200 dark:bg-slate-800/50 rounded-full h-8 relative">
                                <div 
                                    className={`absolute top-0 h-full rounded-full ${trend.netChange >= 0 ? 'bg-green-500/80 left-1/2' : 'bg-red-500/80 right-1/2'}`}
                                    style={{ width: `${(Math.abs(trend.netChange) / maxNetChange) * 50}%` }}
                                ></div>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-white z-10">{formatCurrency(trend.netChange)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Movers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Users className="w-6 h-6 text-sky-500 dark:text-sky-400" /> Top 5 Clients by Net Inflow</h2>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {dashboardData.topInflows.filter(c => c.netTotal > 0).map(client => (
                            <li key={client.clientName} className="flex justify-between items-center py-3">
                                <span className="text-slate-800 dark:text-slate-200">{client.clientName}</span>
                                <span className="font-mono text-green-600 dark:text-green-400">{formatCurrency(client.netTotal)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Users className="w-6 h-6 text-sky-500 dark:text-sky-400" /> Top 5 Clients by Net Outflow</h2>
                     <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                        {dashboardData.topOutflows.filter(c => c.netTotal < 0).map(client => (
                            <li key={client.clientName} className="flex justify-between items-center py-3">
                                <span className="text-slate-800 dark:text-slate-200">{client.clientName}</span>
                                <span className="font-mono text-red-600 dark:text-red-400">{formatCurrency(client.netTotal)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;