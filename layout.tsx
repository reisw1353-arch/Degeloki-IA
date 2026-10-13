import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DEGELOKI — sem paciência, mas com personalidade',
  description: 'Converse com DEGELOKI, sua IA direta, irônica e espontânea.',
  applicationName: 'DEGELOKI'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090810'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
