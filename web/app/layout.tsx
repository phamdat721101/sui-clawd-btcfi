import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenClaw Command Center',
  description: 'Sui BTCFi yield intelligence dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
