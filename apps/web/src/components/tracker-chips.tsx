/** Category + status chips shared by the dashboard list and tracker detail. */
export function CategoryChip({ category }: { category: string }) {
  const isDevelopment = category === "DEVELOPMENT";
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-[4px] px-2 text-xs font-medium ${
        isDevelopment
          ? "bg-accent text-[color:var(--accent-foreground)]"
          : "bg-[#f0ecfc] text-[#5238b8] dark:bg-[#2a2440] dark:text-[#c4b5fd]"
      }`}
    >
      {isDevelopment ? "Development" : "Support"}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const isCompleted = status === "COMPLETED";
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-[4px] px-2 text-xs font-medium ${
        isCompleted
          ? "bg-[#e7f5ec] text-[#1e7a3a] dark:bg-[#17301f] dark:text-[#6ee7a0]"
          : "bg-[#fff0e8] text-[#b8400f] dark:bg-[#33230f] dark:text-[#fdba74]"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isCompleted ? "bg-[#34a853]" : "bg-[#ff672f]"
        }`}
      />
      {isCompleted ? "Completed" : "Open"}
    </span>
  );
}
