import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number; // ms, default 4000
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
    return ctx;
};

// ─── Single Toast Item ────────────────────────────────────────────────────────
const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
    error:   <XCircle    className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info:    <Info       className="w-5 h-5 text-blue-500 shrink-0" />,
};

const BG: Record<ToastType, string> = {
    success: 'border-l-4 border-emerald-500 bg-white',
    error:   'border-l-4 border-red-500 bg-white',
    warning: 'border-l-4 border-amber-500 bg-white',
    info:    'border-l-4 border-blue-500 bg-white',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    const [visible, setVisible] = useState(false);

    // Animate in
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    // Auto-dismiss
    useEffect(() => {
        const dur = toast.duration ?? 4000;
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onDismiss(toast.id), 300);
        }, dur);
        return () => clearTimeout(t);
    }, [toast.id, toast.duration, onDismiss]);

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg ${BG[toast.type]} transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            } max-w-sm w-full`}
        >
            {ICONS[toast.type]}
            <p className="text-sm text-gray-800 font-medium flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => { setVisible(false); setTimeout(() => onDismiss(toast.id), 300); }}
                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// ─── Toast Container ──────────────────────────────────────────────────────────
const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]); // max 5 visible
    }, []);

    const success = useCallback((msg: string, dur?: number) => toast(msg, 'success', dur), [toast]);
    const error   = useCallback((msg: string, dur?: number) => toast(msg, 'error', dur ?? 6000), [toast]);
    const warning = useCallback((msg: string, dur?: number) => toast(msg, 'warning', dur), [toast]);
    const info    = useCallback((msg: string, dur?: number) => toast(msg, 'info', dur), [toast]);

    return (
        <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};
