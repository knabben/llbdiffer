import Link from 'next/link';
import { TopNav } from '../components/TopNav';

interface RouteCard {
  href: string;
  title: string;
  description: string;
  accentClassName: string;
}

const ROUTES: RouteCard[] = [
  {
    href: '/compare',
    title: 'Compare',
    description:
      'Side-by-side diff of two BuildKit LLB .dot builds — rendered graphs, an added/removed/shared summary, and an optional AI narrative explaining the diff.',
    accentClassName: 'hover:border-added',
  },
  {
    href: '/determinism',
    title: 'Determinism Analysis',
    description:
      'Root-cause analysis of BuildKit LLB JSON dumps — structural alignment, blast radius, and a named cause + fix for what actually changed. Works from one upload, or two for a full comparison.',
    accentClassName: 'hover:border-accent',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <TopNav current="/" />
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-neutral-100">llbdiffer</h1>
        <p className="mt-2 text-sm text-neutral-400">Diff-first tooling for BuildKit LLB DAGs.</p>
      </div>

      <nav aria-label="Main" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className={`flex flex-col gap-2 rounded-xl border border-border bg-panel p-5 text-left transition-colors ${route.accentClassName}`}
          >
            <span className="text-base font-semibold text-neutral-100">{route.title}</span>
            <span className="text-sm text-neutral-400">{route.description}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
