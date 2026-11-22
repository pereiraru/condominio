import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import PwaRegistration from '@/components/PwaRegistration';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: 'Condomínio — Rua Vieira da Silva, n.º 6',
  description:
    'Portal de gestão do condomínio — situação financeira, anomalias, atas e administração',
  applicationName: 'Condomínio',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Condomínio',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="font-sans">
        <AuthProvider>{children}</AuthProvider>
        <PwaRegistration />
      </body>
    </html>
  );
}
