import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISSED_KEY = 'pwa_install_banner_dismissed';

const InstallBanner: React.FC = () => {
    const { isInstallable, installApp, isStandalone, isIOS } = usePWAInstall();
    const [dismissed, setDismissed] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
        if (wasDismissed) return;

        // Show after a short delay so the page has loaded
        const timer = setTimeout(() => {
            if (!isStandalone && (isInstallable || isIOS)) {
                setVisible(true);
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, [isInstallable, isIOS, isStandalone]);

    // Also show when isInstallable becomes true after initial render (Android)
    useEffect(() => {
        const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
        if (wasDismissed || dismissed) return;
        if (isInstallable && !isStandalone) {
            setVisible(true);
        }
    }, [isInstallable, isStandalone, dismissed]);

    const handleDismiss = () => {
        setVisible(false);
        setDismissed(true);
        sessionStorage.setItem(DISMISSED_KEY, '1');
    };

    const handleInstall = async () => {
        if (isIOS) return; // iOS shows instructions, no action needed
        await installApp();
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 animate-in slide-in-from-bottom duration-300">
            <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden">
                {/* Green top accent */}
                <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />

                <div className="p-4">
                    <div className="flex items-start gap-3">
                        {/* App icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-md">
                            <img src="/pwa-192x192.png" alt="SafaiConnect" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-gray-900 text-sm">Install SafaiConnect</p>
                                <button
                                    onClick={handleDismiss}
                                    className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    aria-label="Dismiss"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isIOS
                                    ? 'Add to your home screen for the best experience'
                                    : 'Get quick access — works offline too'}
                            </p>

                            {isIOS ? (
                                <div className="mt-2 bg-gray-50 rounded-xl p-2.5 text-xs text-gray-600 space-y-1">
                                    <p className="font-semibold text-gray-700">How to install on iOS:</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">1</span>
                                        <span>Tap the <Share className="inline w-3.5 h-3.5 text-blue-600" /> <strong>Share</strong> button in Safari</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">2</span>
                                        <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">3</span>
                                        <span>Tap <strong>"Add"</strong> in the top right</span>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleInstall}
                                    className="mt-2.5 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Install App
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallBanner;
