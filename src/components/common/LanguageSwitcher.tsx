import React, { useState, useRef, useEffect, useId } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const LOCALES: { code: string; label: string; nativeLabel: string }[] = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
    { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
    { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
    { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
    { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
    { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
    { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
    { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
];

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                // Return focus to trigger button
                ref.current?.querySelector('button')?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen]);

    const current = LOCALES.find((l) => l.code === language) ?? LOCALES[0];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-label={`Switch language, current: ${current.label}`}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
            >
                <Globe className="w-4 h-4 text-green-600" aria-hidden="true" />
                <span className="hidden sm:inline">{current.nativeLabel}</span>
            </button>

            {isOpen && (
                <ul
                    id={listboxId}
                    role="listbox"
                    aria-label="Select language"
                    aria-activedescendant={`lang-option-${language}`}
                    className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto py-1"
                >
                    {LOCALES.map((locale) => (
                        <li
                            key={locale.code}
                            id={`lang-option-${locale.code}`}
                            role="option"
                            aria-selected={language === locale.code}
                            onClick={() => {
                                setLanguage(locale.code);
                                setIsOpen(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setLanguage(locale.code);
                                    setIsOpen(false);
                                }
                            }}
                            tabIndex={0}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between cursor-pointer
                                ${language === locale.code
                                    ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span>{locale.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{locale.nativeLabel}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LanguageSwitcher;
