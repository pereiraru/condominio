'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/transactions', label: 'Transacoes', icon: '💰' },
  { href: '/dashboard/units', label: 'Fraccoes', icon: '🏠' },
  { href: '/dashboard/creditors', label: 'Credores', icon: '🏢' },
  { href: '/dashboard/payments', label: 'Pagamentos', icon: '📋' },
  { href: '/dashboard/documents', label: 'Documentos', icon: '📄' },
  { href: '/dashboard/reports', label: 'Relatorios', icon: '📈' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Condominio</h1>
      </div>

      <nav className="px-4 space-y-1 flex-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 mt-auto">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          <span>🚪</span>
          <span className="font-medium">Sair</span>
        </Link>
      </div>
    </aside>
  );
}
