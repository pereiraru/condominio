'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const ICONS = {
  portal: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  unit: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ),
  incidents: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  atas: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
  transactions: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  creditors: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  annualReport: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  documents: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

const financeItems: NavItem[] = [
  { href: '/dashboard/transactions', label: 'Transações', icon: ICONS.transactions },
  { href: '/dashboard/units', label: 'Frações', icon: ICONS.unit },
  { href: '/dashboard/creditors', label: 'Credores', icon: ICONS.creditors },
  { href: '/dashboard/reports', label: 'Relatórios', icon: ICONS.reports },
  { href: '/dashboard/relatorio-contas', label: 'Rel. Contas', icon: ICONS.annualReport },
  { href: '/dashboard/documents', label: 'Documentos', icon: ICONS.documents },
];

const adminItems: NavItem[] = [
  { href: '/dashboard/admin/budgets', label: 'Administração', icon: ICONS.admin },
];

function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportsWebInstall, setSupportsWebInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  const isAdmin = session?.user?.role === 'admin';
  const userUnitId = session?.user?.unitId;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standaloneCheck =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standaloneCheck);

    const webInstallAvailable =
      typeof (Navigator.prototype as unknown as { install?: unknown }).install === 'function';
    setSupportsWebInstall(webInstallAvailable);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallStatus('Aplicação instalada.');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const canPromptInstall = !isStandalone && (supportsWebInstall || deferredPrompt !== null);

  async function handleInstallClick() {
    if (installing) return;
    setInstalling(true);
    setInstallStatus(null);

    try {
      const navWithInstall = navigator as unknown as { install?: () => Promise<void> };
      if (supportsWebInstall && typeof navWithInstall.install === 'function') {
        await navWithInstall.install();
        setInstallStatus('Aplicação instalada ou aberta.');
      } else if (deferredPrompt) {
        const promptEvent = deferredPrompt;
        setDeferredPrompt(null);
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setInstallStatus('Aplicação instalada.');
          setIsStandalone(true);
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        console.error('Web app install error:', err);
      }
    } finally {
      setInstalling(false);
    }
  }

  const portalItems: NavItem[] = [
    { href: '/dashboard', label: 'Portal', icon: ICONS.portal },
    ...(!isAdmin && userUnitId
      ? [{ href: `/dashboard/units/${userUnitId}`, label: 'Minha Fração', icon: ICONS.unit }]
      : []),
    { href: '/dashboard/incidents', label: 'Anomalias', icon: ICONS.incidents },
    { href: '/dashboard/atas', label: 'Atas', icon: ICONS.atas },
  ];

  const bottomNavItems: NavItem[] = isAdmin
    ? [
        { href: '/dashboard', label: 'Portal', icon: ICONS.portal },
        { href: '/dashboard/incidents', label: 'Anomalias', icon: ICONS.incidents },
        { href: '/dashboard/units', label: 'Frações', icon: ICONS.unit },
        { href: '/dashboard/admin/budgets', label: 'Admin', icon: ICONS.admin },
      ]
    : [
        { href: '/dashboard', label: 'Portal', icon: ICONS.portal },
        ...(userUnitId
          ? [{ href: `/dashboard/units/${userUnitId}`, label: 'Fração', icon: ICONS.unit }]
          : []),
        { href: '/dashboard/incidents', label: 'Anomalias', icon: ICONS.incidents },
        { href: '/dashboard/atas', label: 'Atas', icon: ICONS.atas },
      ];

  const renderSidebarContent = (showCloseButton: boolean) => (
    <>
      <div className="p-5 flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/icons/icon.svg"
            alt=""
            aria-hidden="true"
            width={34}
            height={34}
            className="w-[34px] h-[34px] rounded-xl shrink-0 shadow-sm ring-1 ring-white/15"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white tracking-tight truncate">Condomínio</h1>
            <p className="text-xs text-slate-400 mt-0.5 truncate">Rua Vieira da Silva, n.º 6</p>
          </div>
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="px-3 py-4 space-y-5 flex-1 overflow-y-auto">
        <div>
          <p className="px-3.5 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Portal
          </p>
          <div className="space-y-1">
            {portalItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isRouteActive(pathname, item.href) ? 'sidebar-item-active' : 'sidebar-item'}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="px-3.5 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gestão Financeira
            </p>
            <div className="space-y-1">
              {financeItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isRouteActive(pathname, item.href) ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div>
            <p className="px-3.5 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Administração
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isRouteActive(pathname, item.href) ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-3 mt-auto border-t border-white/10">
        {session?.user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">
              {session.user.name || session.user.email}
            </p>
            <p className="text-xs text-slate-400">
              {isAdmin ? 'Administrador' : session.user.unitCode || 'Condómino'}
            </p>
          </div>
        )}

        {canPromptInstall && (
          <button
            type="button"
            onClick={handleInstallClick}
            aria-disabled={installing ? 'true' : undefined}
            className="sidebar-item w-full text-left mb-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 font-medium"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
              />
            </svg>
            <span>{installing ? 'A instalar...' : 'Instalar App'}</span>
          </button>
        )}

        {installStatus && (
          <p role="status" className="px-3.5 pb-1.5 text-[11px] text-emerald-300">
            {installStatus}
          </p>
        )}

        <Link
          href="/change-password"
          className={pathname === '/change-password' ? 'sidebar-item-active mb-1' : 'sidebar-item mb-1'}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Alterar Password</span>
        </Link>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="sidebar-item w-full text-left"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  const mobileColsClass =
    bottomNavItems.length === 3 && !isAdmin
      ? 'grid-cols-3'
      : bottomNavItems.length === 4 && !isAdmin
      ? 'grid-cols-4'
      : 'grid-cols-5';

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="sidebar print:hidden">{renderSidebarContent(false)}</aside>

      {/* Mobile / Tablet Fixed Top Bar */}
      <header className="lg:hidden print:hidden fixed top-0 inset-x-0 z-30 bg-slate-900 text-white shadow-sm safe-top-bar">
        <div className="h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="p-2 -ml-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-200 hover:text-white hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base tracking-tight truncate">
              <img
                src="/icons/icon.svg"
                alt=""
                aria-hidden="true"
                width={26}
                height={26}
                className="w-[26px] h-[26px] rounded-lg shrink-0 ring-1 ring-white/15"
              />
              <span className="truncate">Condomínio</span>
            </Link>
          </div>

          {session?.user && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 text-slate-200 shrink-0">
              {isAdmin ? 'Admin' : session.user.unitCode || 'Condómino'}
            </span>
          )}
        </div>
      </header>

      {/* Mobile / Tablet Slide-Over Drawer */}
      {mobileOpen && (
        <div className="lg:hidden print:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] h-full bg-slate-900 flex flex-col shadow-2xl safe-drawer">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navegação rápida"
        className={`md:hidden print:hidden fixed bottom-0 inset-x-0 min-h-16 z-30 bg-white/95 backdrop-blur border-t border-slate-200 grid ${mobileColsClass} safe-bottom-bar`}
      >
        {bottomNavItems.map((item) => {
          const active = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-h-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-[70px]">{item.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="min-h-[44px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-800"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Menu</span>
          </button>
        )}
      </nav>
    </>
  );
}
