import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HoneyForge | Управление флотом honeypot-ловушек и сбор киберразведки',
  description: 'Централизованное управление, конструктор профилей и real-time лента телеметрии',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark h-full antialiased">
      <body className="min-h-full bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
