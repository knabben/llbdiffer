import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'llbdiffer',
  description: 'Side-by-side diff viewer for BuildKit LLB DAGs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface text-neutral-200 antialiased">{children}</body>
    </html>
  );
}
