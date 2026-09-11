"use client";

import { useEffect, type ReactNode } from "react";
import { Trash2, X } from "lucide-react";

export type ConfirmAction = {
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
};

export function ConfirmModal({
  open,
  title,
  description,
  actions,
  isPending = false,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  actions: ConfirmAction[];
  isPending?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, isPending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#020617]/90 backdrop-blur-sm"
        onClick={() => {
          if (!isPending) onClose();
        }}
        aria-hidden
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-[350px] rounded-[24px] border border-[#334155] bg-[#1E293B] p-8 text-center shadow-[0_24px_64px_-12px_rgba(0,0,0,0.4)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          disabled={isPending}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-[#172033] hover:text-[#F8FAFC]"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="flex flex-col items-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#F87171]/10 text-[#F87171]">
            <Trash2 className="size-6" aria-hidden />
          </span>

          <div className="mt-5 min-w-0">
            <h2
              id="confirm-modal-title"
              className="font-outfit text-2xl font-bold text-[#F8FAFC]"
            >
              {title}
            </h2>
            <div className="mt-2 text-sm leading-5 text-[#94A3B8]">{description}</div>
          </div>
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-12 flex-1 rounded-lg border border-[#334155] px-4 text-sm font-bold text-[#F8FAFC] transition-colors hover:bg-[#172033] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>

          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={isPending}
              className={`h-12 flex-1 rounded-lg px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                action.tone === "neutral"
                  ? "border border-[#334155] text-[#F8FAFC] hover:bg-[#172033]"
                  : "bg-[#F87171] text-white hover:bg-[#FB7185]"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
