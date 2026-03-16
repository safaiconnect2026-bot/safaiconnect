import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageContextValue {
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string) => string;
    dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue>({
    language: 'en',
    setLanguage: () => { },
    t: (key) => key,
    dir: 'ltr',
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t, i18n } = useTranslation();

    const setLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem('sc_language', lang);
    };

    useEffect(() => {
        const saved = localStorage.getItem('sc_language');
        if (saved) {
            i18n.changeLanguage(saved);
        }
    }, [i18n]);

    const dir = ['ur', 'sd'].includes(i18n.language) ? 'rtl' : 'ltr';

    return (
        <LanguageContext.Provider value={{ language: i18n.language, setLanguage, t, dir }}>
            <div dir={dir} className={dir === 'rtl' ? 'font-urdu' : ''}>
                {children}
            </div>
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
