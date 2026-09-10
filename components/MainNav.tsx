"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, TrendingUp } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projection", label: "Projeção", icon: TrendingUp },
];

function getUserName(user: User) {
  const metadata = user.user_metadata;
  const name = metadata.full_name ?? metadata.name;

  return typeof name === "string" && name.trim() ? name.trim() : user.email;
}

function getUserInitials(user: User) {
  const name = getUserName(user) ?? "Saldo Seguro";

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MainNav({ user }: { user: User | null }) {
  const pathname = usePathname();

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/recuperar-senha" ||
    pathname === "/nova-senha"
  ) {
    return null;
  }

  return (
    <header className="shrink-0 border-b border-[#334155] bg-[#0F172A]">
      <div className="flex h-[76px] w-full items-center gap-3 px-4 sm:gap-8 sm:px-8 lg:px-10">
        <span className="flex shrink-0 items-center gap-2.5 font-outfit text-xl font-bold text-[#F8FAFC]">
          <img alt="" className="size-10 rounded-[10px]" src="/icon-192.png" />
          <span className="hidden sm:inline">Saldo Seguro</span>
        </span>

        <nav className="flex min-w-0 items-center gap-1.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm transition-colors sm:min-h-0 ${
                  isActive
                    ? "bg-[#1E293B] font-bold text-[#F8FAFC]"
                    : "font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-4">
          <ThemeToggle />
          {user && (
            <div className="flex min-w-0 items-center gap-3" title={user.email ?? undefined}>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-40 truncate text-sm font-bold text-[#F8FAFC]">
                  {getUserName(user)}
                </p>
                {user.email && user.email !== getUserName(user) && (
                  <p className="max-w-40 truncate text-xs text-[#94A3B8]">
                    {user.email}
                  </p>
                )}
              </div>
              <div
                aria-label={`Perfil de ${getUserName(user) ?? "usuário"}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#334155] bg-[#10B981] text-xs font-bold text-white"
              >
                {getUserInitials(user)}
              </div>
              <LogoutButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
