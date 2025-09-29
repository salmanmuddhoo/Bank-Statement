/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import { MessageSquareWarning } from './Icons.tsx';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  feedbackForm: {
    openingBalance: string;
    closingBalance: string;
    totalCredit: string;
    totalDebit: string;
    notes: string;
  };
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit, feedbackForm, onFormChange }) => {
  useEffect(() => {
    if (isOpen) {
      console.log("[FeedbackModal] Modal is now open.");
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-100/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-300 dark:border-white/10 rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquareWarning className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />
          Report Analysis Mismatch
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Help improve the AI by providing the correct values from the statement. The AI's calculated values are pre-filled below—please edit them as needed.
        </p>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="feedback-openingBalance" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Correct Opening Balance</label>
              <input type="number" name="openingBalance" id="feedback-openingBalance" value={feedbackForm.openingBalance} onChange={onFormChange} className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
            </div>
            <div>
              <label htmlFor="feedback-closingBalance" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Correct Closing Balance</label>
              <input type="number" name="closingBalance" id="feedback-closingBalance" value={feedbackForm.closingBalance} onChange={onFormChange} className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="feedback-totalCredit" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Correct Total Credit</label>
              <input type="number" name="totalCredit" id="feedback-totalCredit" value={feedbackForm.totalCredit} onChange={onFormChange} className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
            </div>
            <div>
              <label htmlFor="feedback-totalDebit" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Correct Total Debit</label>
              <input type="number" name="totalDebit" id="feedback-totalDebit" value={feedbackForm.totalDebit} onChange={onFormChange} className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
            </div>
          </div>
          <div>
            <label htmlFor="feedback-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes (Optional)</label>
            <textarea name="notes" id="feedback-notes" value={feedbackForm.notes} onChange={onFormChange} placeholder="e.g., 'Missed a bank fee on line 23'" rows={3} className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"></textarea>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900">
            Cancel
          </button>
          <button onClick={onSubmit} className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900">
            Submit Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
