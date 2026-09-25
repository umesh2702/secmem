import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Our Memory — Private Shared Digital Memory Vault',
  description: 'A private shared digital memory vault for two people.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="bg-[#090B10] text-slate-100 antialiased h-full overflow-hidden">
        {children}
      </body>
    </html>
  );
}

