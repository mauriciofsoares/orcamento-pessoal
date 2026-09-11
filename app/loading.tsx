export default function Loading() {
  return (
    <main className="w-full px-4 py-7 sm:px-8 lg:px-10">
      <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between lg:mb-7">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[#1E293B] sm:h-10 sm:w-64" />
          <div className="h-4 w-32 animate-pulse rounded bg-[#1E293B]" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-[#1E293B]" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-[#1E293B]" />
        </div>
      </header>

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="h-28 animate-pulse rounded-2xl border border-[#334155] bg-[#172033]" />
          <div className="h-28 animate-pulse rounded-2xl border border-[#334155] bg-[#172033]" />
          <div className="h-28 animate-pulse rounded-2xl border border-[#334155] bg-[#172033]" />
        </div>

        <div className="h-96 w-full animate-pulse rounded-2xl border border-[#334155] bg-[#1E293B]" />
      </div>
    </main>
  );
}
