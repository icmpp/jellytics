"use client";

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  /** Tailwind classes for the icon wrapper box, e.g. "bg-blue-500/15 border border-blue-500/25" */
  iconBg?: string;
  /** Optional extra content (e.g. count) on the right */
  extra?: React.ReactNode;
}

export function SectionHeader({ icon, title, iconBg, extra }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
        {icon && (
          <div
            className={`flex items-center justify-center p-2 rounded-xl ${
              iconBg ?? "bg-white/8 border border-white/10"
            }`}
          >
            {icon}
          </div>
        )}
        <h2 className="text-sm sm:text-base font-semibold text-white">{title}</h2>
      </div>
      {extra}
    </div>
  );
}
