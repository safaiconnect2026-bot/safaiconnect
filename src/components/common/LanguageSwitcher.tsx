import React, { useState, useRef, useEffect } from 'react';
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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const current = LOCALES.find((l) => l.code === language) ?? LOCALES[0];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setIsOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
                aria-label="Switch language"
            >
                <Globe className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline">{current.nativeLabel}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
                    {LOCALES.map((locale) => (
                        <button
                            key={locale.code}
                            onClick={() => {
                                setLanguage(locale.code);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between
                ${language === locale.code
                                    ? 'bg-green-50 text-green-700 font-semibold'
                                    : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <span>{locale.label}</span>
                            <span className="text-xs text-gray-500 font-medium">{locale.nativeLabel}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
