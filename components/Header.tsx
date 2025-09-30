/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ReceiptText, Settings } from './Icons.tsx';
import ThemeSwitcher from './ThemeSwitcher.tsx';

interface HeaderProps {
    onSettingsClick: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSettingsClick, theme, toggleTheme }) => {
    return (
        <header className="flex justify-between items-center text-center mb-8">
            <div className="flex-1"></div> {/* Spacer */}
            <div className="flex-1">
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-3">
                    <ReceiptText className="w-10 h-10 text-sky-500 dark:text-sky-400" />
                    <span>AI Bank Statement Analyzer</span>
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">Upload or paste a bank statement to analyze client payment trends.</p>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
                <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />
                <button onClick={onSettingsClick} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" aria-label="Settings">
                    <Settings className="w-6 h-6" />
                </button>
            </div>
        </header>
    );
}

export default Header;