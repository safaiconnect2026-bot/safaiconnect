import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowRight, BarChart3, Users, Shield, Menu, X, Globe,
    Recycle, Download, MapPin, Bell, CheckCircle, Zap, Star,
    Smartphone, Lock, TrendingUp, Mail, Phone,
    Building2, Target, Award, Send,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';

interface LandingPageProps {
    onGetStarted: () => void;
}

/* ---------- tiny counter hook ---------- */
function useCounter(target: number, duration = 2000, start = false) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!start) return;
        let startTime: number | null = null;
        const step = (ts: number) => {
            if (!startTime) startTime = ts;
            const progress = Math.min((ts - startTime) / duration, 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [start, target, duration]);
    return count;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [statsVisible, setStatsVisible] = useState(false);
    const statsRef = useRef<HTMLDivElement>(null);
    const { isInstallable, installApp, isStandalone } = usePWAInstall();
    // Detect Capacitor native WebView so Install App button is hidden inside the Android app
    const isNativeApp = !!(window as any).Capacitor || window.location.protocol === 'capacitor:';
    const { t } = useLanguage();
    const { info: toastInfo, success: toastSuccess } = useToast();

    const c1 = useCounter(50000, 2000, statsVisible);
    const c2 = useCounter(1200, 2000, statsVisible);
    const c3 = useCounter(45, 2000, statsVisible);
    const c4 = useCounter(120, 2000, statsVisible);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
            { threshold: 0.3 }
        );
        if (statsRef.current) obs.observe(statsRef.current);
        return () => obs.disconnect();
    }, []);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        setIsMenuOpen(false);
    };

    const handleInstall = () => {
        if (isStandalone) return; // Already running as installed app — nothing to do
        if (isInstallable) {
            installApp();
        } else {
            toastInfo('To install: Desktop — click the install icon in your address bar. Mobile — tap "Share" → "Add to Home Screen".');
        }
    };

    // Data structures with translations
    const navItems = [
        { id: 'features', label: t('nav_features') },
        { id: 'about', label: t('nav_about') },
        { id: 'solutions', label: t('nav_solutions') },
        { id: 'contact', label: t('nav_contact') },
    ];

    const stats = [
        { label: t('stat_citizens'), value: c1.toLocaleString(), suffix: '+', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: t('stat_waste'), value: c2.toLocaleString(), suffix: '+', icon: Recycle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: t('stat_efficiency'), value: c3, suffix: '%', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: t('stat_zones'), value: c4, suffix: '+', icon: Globe, color: 'text-orange-600', bg: 'bg-orange-50' },
    ];

    const roles = [
        {
            role: t('role_citizens'),
            emoji: '🏘️',
            bg: 'bg-white',
            border: 'border-blue-100',
            accent: 'text-blue-600',
            btnClass: 'text-blue-700 bg-blue-50 hover:bg-blue-100',
            perks: [t('perk_citizen_report'), t('perk_citizen_track'), t('perk_citizen_book'), t('perk_citizen_earn')],
        },
        {
            role: t('role_workers'),
            emoji: '👷',
            bg: 'bg-white',
            border: 'border-emerald-100',
            accent: 'text-emerald-600',
            btnClass: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
            perks: [t('perk_worker_tasks'), t('perk_worker_proof'), t('perk_worker_attendance'), t('perk_worker_training')],
        },
        {
            role: t('role_admins'),
            emoji: '📊',
            bg: 'bg-white',
            border: 'border-purple-100',
            accent: 'text-purple-600',
            btnClass: 'text-purple-700 bg-purple-50 hover:bg-purple-100',
            perks: [t('perk_admin_manage'), t('perk_admin_monitor'), t('perk_admin_salary'), t('perk_admin_verify')],
        },
        {
            role: t('role_superadmins'),
            emoji: '🛡️',
            bg: 'bg-white',
            border: 'border-amber-100',
            accent: 'text-amber-600',
            btnClass: 'text-amber-700 bg-amber-50 hover:bg-amber-100',
            perks: [t('perk_superadmin_overview'), t('perk_superadmin_manage'), t('perk_superadmin_inventory'), t('perk_superadmin_analytics')],
        },
    ];

    const features = [
        { icon: MapPin, title: t('feat_geo_title'), desc: t('feat_geo_desc'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { icon: Bell, title: t('feat_notif_title'), desc: t('feat_notif_desc'), color: 'text-blue-600', bg: 'bg-blue-50' },
        { icon: Shield, title: t('feat_role_title'), desc: t('feat_role_desc'), color: 'text-purple-600', bg: 'bg-purple-50' },
        { icon: Smartphone, title: t('feat_offline_title'), desc: t('feat_offline_desc'), color: 'text-orange-600', bg: 'bg-orange-50' },
        { icon: BarChart3, title: t('feat_analytics_title'), desc: t('feat_analytics_desc'), color: 'text-pink-600', bg: 'bg-pink-50' },
        { icon: Lock, title: t('feat_secure_title'), desc: t('feat_secure_desc'), color: 'text-teal-600', bg: 'bg-teal-50' },
        { icon: Users, title: t('feat_multi_title'), desc: t('feat_multi_desc'), color: 'text-amber-600', bg: 'bg-amber-50' },
        { icon: Zap, title: t('feat_voice_title'), desc: t('feat_voice_desc'), color: 'text-cyan-600', bg: 'bg-cyan-50' },
        { icon: Star, title: t('feat_reward_title'), desc: t('feat_reward_desc'), color: 'text-yellow-600', bg: 'bg-yellow-50' },
    ];

    const footerCols = [
        { heading: t('footer_platform'), links: [t('link_features'), t('link_roles'), t('link_pricing'), t('link_changelog')] },
        { heading: t('footer_company'), links: [t('link_about'), t('link_careers'), t('link_blog'), t('link_contact')] },
        { heading: t('footer_legal'), links: [t('link_privacy'), t('link_terms'), t('link_cookie')] },
    ];

    // Footer bottom links
    const footerBottomLinks = [t('link_privacy'), t('link_security'), t('link_sitemap')];


    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 overflow-x-hidden selection:bg-emerald-100 selection:text-emerald-900">

            {/* ─── NAV ─── */}
            <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
                <div className="container mx-auto px-4 md:px-8 flex justify-between items-center">
                    {/* Logo */}
                    <div onClick={() => scrollTo('hero')} className="flex items-center gap-2.5 cursor-pointer group">
                        <img src="/logo.png" alt="Safai Connect Logo" className="h-8 sm:h-10 w-auto max-w-[140px] object-contain group-hover:scale-105 transition-transform" />
                        
                    </div>

                    {/* Desktop links */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => scrollTo(item.id)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-all"
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        {!isStandalone && !isNativeApp && (
                        <button onClick={handleInstall} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 rounded-full transition-all">
                            <Download className="w-4 h-4" /> {t('nav_install')}
                        </button>
                        )}
                        <button onClick={onGetStarted} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-emerald-700 transition-colors">
                            Log in
                        </button>
                        <button
                            onClick={onGetStarted}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-1.5"
                        >
                            {t('nav_get_started')} <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Mobile toggle */}
                    <button
                        className="md:hidden p-2 text-gray-600 hover:text-emerald-600 bg-white/50 backdrop-blur-sm rounded-lg"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="absolute top-full left-0 w-full bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-xl py-4 px-4 flex flex-col gap-2 md:hidden">
                        {navItems.map((item) => (
                            <button key={item.id} onClick={() => scrollTo(item.id)} className="text-left py-3 px-4 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl capitalize font-medium transition-colors">
                                {item.label}
                            </button>
                        ))}
                        <div className="h-px bg-gray-100 my-1" />
                        {!isStandalone && !isNativeApp && (
                        <button onClick={handleInstall} className="w-full py-3 text-emerald-600 font-semibold rounded-xl bg-emerald-50 flex items-center justify-center gap-2">
                            <Download className="w-5 h-5" /> {t('hero_install_btn')}
                        </button>
                        )}
                        <button onClick={onGetStarted} className="w-full py-3 text-white font-bold rounded-xl bg-gray-900 shadow-lg">
                            {t('hero_get_started_btn')}
                        </button>
                    </div>
                )}
            </nav>

            {/* ─── HERO ─── */}
            <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden pt-20">
                {/* Background layers */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className="absolute inset-0 dot-grid opacity-[0.35]" />
                    <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-200/50 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
                    <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-teal-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
                    <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] bg-cyan-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
                    <div className="absolute top-[40%] right-[10%] w-[300px] h-[300px] bg-emerald-100/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-emerald-200/60 bg-white/70 backdrop-blur-md shadow-lg shadow-emerald-100/40 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">{t('hero_badge')}</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-black tracking-tight leading-[1.08] mb-8 text-gray-900 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                        {t('hero_title_1')}<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 drop-shadow-sm">
                            {t('hero_title_2')}
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {t('hero_subtitle')}
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in zoom-in duration-700 delay-300">
                        <button
                            onClick={onGetStarted}
                            className="w-full sm:w-auto px-10 py-4 bg-emerald-600 text-white rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/25 hover:shadow-2xl hover:shadow-emerald-600/30 hover:scale-105 flex items-center justify-center gap-2.5 animate-glow"
                        >
                            {t('hero_get_started_btn')} <ArrowRight className="w-5 h-5" />
                        </button>
                        {!isStandalone && !isNativeApp && <button
                            onClick={handleInstall}
                            className="w-full sm:w-auto px-10 py-4 bg-white/80 backdrop-blur-sm text-emerald-700 border-2 border-emerald-100 rounded-full font-bold text-lg hover:border-emerald-300 hover:bg-white transition-all flex items-center justify-center gap-2.5 shadow-sm hover:shadow-lg"
                        >
                            <Download className="w-5 h-5" /> {t('hero_install_btn')}
                        </button>}
                    </div>

                    {/* Trusted by */}
                    <div className="mt-16 animate-in fade-in duration-700 delay-500">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Trusted across India</p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {['Indore', 'Surat', 'Navi Mumbai', 'Delhi', 'Bangalore'].map((city) => (
                                <div key={city} className="flex items-center gap-1.5 px-4 py-1.5 bg-white/70 backdrop-blur-sm border border-gray-200/60 rounded-full shadow-sm text-sm font-medium text-gray-600 hover:border-emerald-200 hover:text-emerald-700 transition-all cursor-default">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                    {city}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </section>

            {/* ─── STATS ─── */}
            <section id="impact" className="py-24 bg-white border-y border-gray-100">
                <div ref={statsRef} className="container mx-auto px-4 md:px-8">
                    <div className="text-center mb-12">
                        <p className="text-emerald-600 text-sm font-bold uppercase tracking-widest mb-3">{t('stat_citizens').includes('Citizens') ? 'Real Impact' : 'Impact'}</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Numbers That Matter</h2>
                        <p className="text-gray-500 max-w-lg mx-auto">Measurable impact across cities, communities, and clean environments.</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                className="group relative p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white to-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: stat.color.replace('text-', '').includes('emerald') ? '#10b981' : stat.color.replace('text-', '').includes('blue') ? '#3b82f6' : stat.color.replace('text-', '').includes('purple') ? '#8b5cf6' : '#f97316' }} />
                                <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <div className="text-3xl md:text-4xl font-black text-gray-900 mb-1 tabular-nums">
                                    {stat.value}<span className={`text-xl font-bold ${stat.color}`}>{stat.suffix}</span>
                                </div>
                                <div className="text-sm font-semibold text-gray-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── ROLE CARDS ─── */}
            <section id="solutions" className="py-24 px-4 bg-gray-50">
                <div className="container mx-auto md:px-8">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 text-sm font-bold uppercase tracking-widest mb-3">{t('roles_built_for')}</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('roles_title')}</h2>
                        <p className="text-gray-600 text-lg max-w-xl mx-auto">{t('roles_subtitle')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {roles.map((card, idx) => {
                            const gradients = [
                                'from-blue-500 to-blue-600',
                                'from-emerald-500 to-emerald-600',
                                'from-purple-500 to-purple-600',
                                'from-amber-500 to-amber-600',
                            ];
                            return (
                                <div
                                    key={card.role}
                                    className={`${card.bg} border ${card.border} rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 group hover:-translate-y-1.5`}
                                >
                                    <div className={`h-1.5 bg-gradient-to-r ${gradients[idx]}`} />
                                    <div className="p-8">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="text-4xl">{card.emoji}</div>
                                            <h3 className={`text-2xl font-bold ${card.accent}`}>{card.role}</h3>
                                        </div>
                                        <ul className="space-y-3 mb-8">
                                            {card.perks.map((p) => (
                                                <li key={p} className="flex items-start gap-3 text-gray-600 text-sm font-medium">
                                                    <CheckCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${card.accent}`} />
                                                    {p}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            onClick={onGetStarted}
                                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm ${card.btnClass} transition-all group-hover:gap-3`}
                                        >
                                            {t('access_dashboard')} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section id="features" className="py-24 px-4 relative bg-white border-t border-gray-100">
                <div className="container mx-auto md:px-8 relative z-10">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 text-sm font-bold uppercase tracking-widest mb-3">{t('features_core')}</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('features_title')}</h2>
                        <p className="text-gray-600 text-lg max-w-xl mx-auto">{t('features_subtitle')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, idx) => (
                            <div
                                key={f.title}
                                className="relative bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-2xl rounded-[2rem] p-8 transition-all duration-500 group hover:-translate-y-1.5 overflow-hidden"
                            >
                                <div className="absolute top-6 right-6 text-[4rem] font-black text-gray-100 group-hover:text-emerald-50 transition-colors select-none leading-none">
                                    {String(idx + 1).padStart(2, '0')}
                                </div>
                                <div className={`relative w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                                    <f.icon className={`w-7 h-7 ${f.color}`} />
                                </div>
                                <h4 className="relative text-gray-900 font-bold text-xl mb-3">{f.title}</h4>
                                <p className="relative text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── ABOUT ─── */}
            <section id="about" className="py-24 px-4 bg-gray-50 border-t border-gray-100">
                <div className="container mx-auto md:px-8">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 text-sm font-bold uppercase tracking-widest mb-3">{t('nav_about')}</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('about_title')}</h2>
                        <p className="text-gray-600 text-lg max-w-2xl mx-auto">{t('about_subtitle')}</p>
                    </div>

                    {/* Mission */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 md:p-12 shadow-sm border border-emerald-100/50 mb-12">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="flex-shrink-0">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-emerald-100">
                                    <Target className="w-10 h-10 text-emerald-600" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('about_mission_title')}</h3>
                                <p className="text-gray-600 text-lg leading-relaxed">{t('about_mission_desc')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Three Pillars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        {[
                            { icon: Users, title: t('about_pillar1_title'), desc: t('about_pillar1_desc'), color: 'text-blue-600', bg: 'bg-blue-50' },
                            { icon: BarChart3, title: t('about_pillar2_title'), desc: t('about_pillar2_desc'), color: 'text-purple-600', bg: 'bg-purple-50' },
                            { icon: Shield, title: t('about_pillar3_title'), desc: t('about_pillar3_desc'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        ].map((p, i) => (
                            <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                <div className={`w-14 h-14 ${p.bg} rounded-2xl flex items-center justify-center mb-5`}>
                                    <p.icon className={`w-7 h-7 ${p.color}`} />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 mb-3">{p.title}</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* About Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { value: '25+', label: t('about_stat1_label'), icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { value: '1.2L+', label: t('about_stat2_label'), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { value: '4,500+', label: t('about_stat3_label'), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { value: '2.8L+', label: t('about_stat4_label'), icon: Award, color: 'text-orange-600', bg: 'bg-orange-50' },
                        ].map((s, i) => (
                            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                                <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                                    <s.icon className={`w-5 h-5 ${s.color}`} />
                                </div>
                                <div className="text-3xl font-black text-gray-900 mb-1">{s.value}</div>
                                <div className="text-sm text-gray-500 font-medium">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CONTACT ─── */}
            <section id="contact" className="py-24 px-4 bg-white border-t border-gray-100">
                <div className="container mx-auto md:px-8">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 text-sm font-bold uppercase tracking-widest mb-3">{t('nav_contact')}</p>
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{t('contact_title')}</h2>
                        <p className="text-gray-600 text-lg max-w-xl mx-auto">{t('contact_subtitle')}</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        {/* Contact Info */}
                        <div className="space-y-6">
                            {[
                                { icon: Mail, label: t('contact_email_label'), value: t('contact_email_value'), color: 'text-blue-600', bg: 'bg-blue-50' },
                                { icon: Phone, label: t('contact_phone_label'), value: t('contact_phone_value'), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { icon: MapPin, label: t('contact_address_label'), value: t('contact_address_value'), color: 'text-purple-600', bg: 'bg-purple-50' },
                            ].map((c, i) => (
                                <div key={i} className="flex items-start gap-5 p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-sm transition-shadow">
                                    <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                                        <c.icon className={`w-6 h-6 ${c.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{c.label}</p>
                                        <p className="text-gray-800 font-medium">{c.value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Contact Form */}
                        <form className="bg-gray-50 rounded-3xl border border-gray-100 p-8 space-y-4" onSubmit={(e) => { e.preventDefault(); toastSuccess(t('contact_sent_success')); }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    placeholder={t('contact_form_name')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder={t('contact_form_email')}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                                    required
                                />
                            </div>
                            <input
                                type="text"
                                placeholder={t('contact_form_subject')}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                            />
                            <textarea
                                rows={5}
                                placeholder={t('contact_form_message')}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 resize-none"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:-translate-y-0.5"
                            >
                                <Send className="w-5 h-5" />
                                {t('contact_send_btn')}
                            </button>
                        </form>
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section id="cta" className="py-32 px-4 relative overflow-hidden bg-gray-900">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900" />
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-3xl" />
                    <div className="absolute inset-0 dot-grid opacity-[0.04]" />
                </div>
                <div className="container mx-auto md:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-8 backdrop-blur-md">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{t('cta_badge')}</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
                        {t('cta_title_1')}<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">{t('cta_title_2')}</span>
                    </h2>
                    <p className="text-xl text-gray-400 mb-12 max-w-xl mx-auto">
                        {t('cta_subtitle')}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={onGetStarted}
                            className="px-10 py-5 bg-emerald-500 text-white rounded-full font-bold text-xl hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-400/30 hover:scale-105 flex items-center justify-center gap-2.5"
                        >
                            {t('cta_get_started')} <ArrowRight className="w-6 h-6" />
                        </button>
                        {!isStandalone && !isNativeApp && (
                        <button
                            onClick={handleInstall}
                            className="px-10 py-5 bg-white/10 text-white border border-white/20 rounded-full font-bold text-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2.5 backdrop-blur-sm"
                        >
                            <Download className="w-6 h-6 text-emerald-400" /> {t('hero_install_btn')}
                        </button>
                        )}
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-gray-900 pt-20 pb-8 px-4 border-t border-gray-800">
                <div className="container mx-auto md:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div>
                            <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => scrollTo('hero')}>
                                <img src="/logo.png" alt="Safai Connect Logo" className="h-10 w-auto max-w-[140px] object-contain" />
                                {/* <span className="text-xl font-bold text-white">SafaiConnect</span> */}
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                {t('footer_tagline')}
                            </p>
                        </div>
                        {footerCols.map((col) => (
                            <div key={col.heading}>
                                <h4 className="font-bold text-white mb-6 text-sm uppercase tracking-wider">{col.heading}</h4>
                                <ul className="space-y-3 text-gray-400 text-sm">
                                    {col.links.map((l) => (
                                        <li key={l} className="hover:text-emerald-400 cursor-pointer transition-colors">{l}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                        <div>© {new Date().getFullYear()} {t('footer_rights')}</div>
                        <div className="flex gap-6">
                            {footerBottomLinks.map((l) => (
                                <span key={l} className="hover:text-emerald-400 cursor-pointer transition-colors">{l}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
