/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Loader2 } from './Icons.tsx';

interface AnalysisProgressProps {
  progress: { step: number; total: number; message: string } | null;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ progress }) => {
  return (
    <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center">
          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
          <span>{progress ? progress.message : 'Preparing Analysis...'}</span>
        </h2>
        {progress && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Step {progress.step} of {progress.total}
          </span>
        )}
      </div>

      {progress && (
        <div className="w-full bg-slate-200 dark:bg-slate-700/50 rounded-full h-2 my-4">
          <div
            className="bg-sky-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${(progress.step / progress.total) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default AnalysisProgress;
