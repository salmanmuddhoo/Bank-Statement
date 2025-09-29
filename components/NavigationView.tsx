/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Zap, LayoutDashboard } from './Icons.tsx';

interface NavigationViewProps {
  activeView: 'analyzer' | 'dashboard';
  setActiveView: (view: 'analyzer' | 'dashboard') => void;
  hasAnalysis: boolean;
}

const NavButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}> = ({ isActive, onClick, disabled, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isActive
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                : 'text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
        {children}
    </button>
);


const NavigationView: React.FC<NavigationViewProps> = ({ activeView, setActiveView, hasAnalysis }) => {
  return (
    <div className="flex justify-center -mb-4">
        <div className="flex justify-center bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl p-2 shadow-lg space-x-2">
            <NavButton
                isActive={activeView === 'analyzer'}
                onClick={() => setActiveView('analyzer')}
            >
                <Zap className="w-5 h-5" />
                <span>Analyzer</span>
            </NavButton>
            <NavButton
                isActive={activeView === 'dashboard'}
                onClick={() => setActiveView('dashboard')}
                disabled={!hasAnalysis}
            >
                <LayoutDashboard className="w-5 h-5" />
                <span>Dashboard</span>
            </NavButton>
        </div>
    </div>
  );
};

export default NavigationView;
