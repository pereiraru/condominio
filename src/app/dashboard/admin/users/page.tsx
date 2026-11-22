'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import UsersManagerPanel from '@/components/UsersManagerPanel';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [session, status, router]);

  if (status === 'loading' || (session && session.user.role !== 'admin')) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">A carregar...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Gestão de Utilizadores
            </h1>
            <p className="text-gray-500 mt-1">
              Criação de acessos por fração, passwords iniciais, permissões de administrador e recuperação
            </p>
          </div>

          <UsersManagerPanel />
        </div>
      </main>
    </div>
  );
}
