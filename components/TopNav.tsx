import Link from 'next/link';

const LINKS: { href: '/' | '/compare' | '/determinism'; label: string }[] = [
  { href: '/', label: 'llbdiffer' },
  { href: '/compare', label: 'Compare' },
  { href: '/determinism', label: 'Determinism' },
];

export interface TopNavProps {
  current: '/' | '/compare' | '/determinism';
}

/** Quick cross-page navigation, shown on every route so switching between Compare and Determinism never requires going back through the landing page. */
export function TopNav({ current }: TopNavProps) {
  return (
    <nav aria-label="Quick navigation" className="flex shrink-0 items-center gap-1 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={current === link.href ? 'page' : undefined}
          className={`rounded-lg px-3 py-1.5 transition-colors ${
            current === link.href ? 'bg-panel text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
