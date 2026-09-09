"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projection", label: "Projeção", icon: TrendingUp },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <Wallet className="size-4 text-emerald-400" aria-hidden />
          <span className="hidden sm:inline">Orçamento</span>
        </span>

        <nav className="flex min-w-0 items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 ${
                  isActive
                    ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-slate-100"
                    : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
