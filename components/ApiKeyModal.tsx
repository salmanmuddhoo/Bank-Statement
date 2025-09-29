/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect } from 'react';
import { KeyRound } from './Icons.tsx';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  tempApiKey: string;
  setTempApiKey: (value: string) => void;
  error: string | null;
  hasExistingKey: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, tempApiKey, setTempApiKey, error, hasExistingKey }) => {
  useEffect(() => {
    if (isOpen) {
      console.log("[ApiKeyModal] Modal is now open.");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-100/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-slate-300 dark:border-white/10 rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-sky-500 dark:text-sky-400" />
          Gemini API Key Required
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Please provide your Gemini API key to use this application. Your key is stored locally in your browser and is not sent to any server.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="api-key-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Your API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter your Gemini API Key"
              className="mt-1 w-full bg-white/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-md p-3 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition duration-200"
            />
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
          <p className="text-sm text-slate-500">
            Don't have a key?{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 underline"
            >
              Get one from Google AI Studio
            </a>
          </p>
        </div>
        <div className="mt-8 flex justify-end gap-4">
          {hasExistingKey && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSave}
            className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900"
          >
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
