"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LayoutDashboard, Menu, TrendingUp, XCircle } from "lucide-react";
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/recuperar-senha" ||
    pathname === "/nova-senha"
  ) {
    return null;
  }

  return (
    <>
      <header className="shrink-0 border-b border-[#334155] bg-[#0F172A]">
        <div className="flex h-[68px] items-center justify-between px-4 md:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Abrir menu"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-[#334155] text-[#F8FAFC]"
          >
            <Menu className="size-[18px]" aria-hidden />
          </button>
          <span className="flex items-center gap-2 font-outfit text-lg font-bold text-[#F8FAFC]">
            <img alt="" className="size-8 rounded-[9px]" src="/icon-192.png" />
            Saldo Seguro
          </span>
          <div className="flex size-9 items-center justify-center rounded-full border border-[#334155] bg-[#10B981] text-xs font-bold text-[#F8FAFC]">
            {user ? getUserInitials(user) : "SS"}
          </div>
        </div>
        <div className="hidden h-[76px] w-full items-center gap-8 px-8 lg:px-10 md:flex">
        <span className="flex shrink-0 items-center gap-2.5 font-outfit text-xl font-bold text-[#F8FAFC]">
          <img alt="" className="size-10 rounded-[10px]" src="/icon-192.png" />
          <span className="hidden sm:inline">Saldo Seguro</span>
        </span>

        <nav className="flex shrink-0 items-center gap-1.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-sm transition-colors ${
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

        <div className="ml-auto flex shrink-0 items-center gap-4">
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-2 sm:gap-3" title={user.email ?? undefined}>
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

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-[#020617]/[0.66]"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="relative flex h-dvh w-[304px] max-w-[82vw] flex-col rounded-r-2xl bg-[#0B1220] px-5 pb-7 pt-6 shadow-[12px_0_32px_rgba(0,0,0,0.4)]">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <img alt="" className="size-10 rounded-[10px]" src="/icon-192.png" />
                <div>
                  <p className="font-outfit text-xl font-bold text-[#F8FAFC]">Saldo Seguro</p>
                  <p className="text-[10px] font-semibold text-[#10B981]">FINANÇAS PESSOAIS</p>
                </div>
              </div>
              <button type="button" aria-label="Fechar menu" onClick={() => setIsMenuOpen(false)} className="p-2 text-[#F8FAFC]">
                <XCircle className="size-5" aria-hidden />
              </button>
            </div>
            {user && (
              <div className="flex items-center gap-3 border-b border-[#334155] py-5">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#10B981] text-[13px] font-bold text-[#F8FAFC]">{getUserInitials(user)}</div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[#F8FAFC]">{getUserName(user)}</p>
                  <p className="truncate text-[13px] text-[#94A3B8]">{user.email}</p>
                </div>
              </div>
            )}
            <nav className="flex flex-col gap-1 border-b border-[#334155] py-4">
              {LINKS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return <Link key={href} href={href} onClick={() => setIsMenuOpen(false)} className={`relative flex h-[52px] items-center gap-3.5 rounded-lg px-4 text-base ${isActive ? "bg-[#10B981]/[0.08] text-[#10B981]" : "text-[#F8FAFC]"}`}>
                  {isActive && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[#10B981]" />}
                  <Icon className="size-[18px]" aria-hidden />{label}
                </Link>;
              })}
            </nav>
            <div className="border-b border-[#334155] py-4"><ThemeToggle inMenu /></div>
            <div className="mt-auto"><LogoutButton inMenu /></div>
          </aside>
        </div>
      )}
    </>
  );
}
