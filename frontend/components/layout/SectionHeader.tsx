"use client";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  /** @deprecated no longer used — icon boxes are removed in terminal theme */
  iconBg?: string;
  /** Optional extra content (e.g. count) on the right */
  extra?: React.ReactNode;
}

export function SectionHeader({ icon, title, extra }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon && <span className="shrink-0 text-white/25">{icon}</span>}
        <span className="shrink-0 text-xs font-mono text-violet-400/55 select-none">#</span>
        <span className="text-xs font-mono text-violet-300/70 tracking-[0.15em] uppercase truncate">
          {title}
        </span>
        <div
          className="flex-1 h-px min-w-4"
          style={{ background: "linear-gradient(90deg, #16162a 60%, transparent)" }}
        />
      </div>
      {extra && <div className="shrink-0">{extra}</div>}
    </div>
  );
}
