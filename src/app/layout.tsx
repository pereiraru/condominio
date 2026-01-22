import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Condominio - Gestao de Condominio',
  description: 'Sistema de gestao de condominio - despesas, pagamentos e documentos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="font-sans">{children}</body>
    </html>
  );
}
