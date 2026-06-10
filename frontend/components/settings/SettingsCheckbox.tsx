import { cn } from "@/lib/utils";

interface SettingsCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function SettingsCheckbox({
  id,
  checked,
  onChange,
  label,
  description,
}: SettingsCheckboxProps) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-sm border border-[#16162a] bg-[#0a0a14] p-3 transition-colors hover:border-violet-500/25 hover:bg-[#0d0d1a] has-focus-visible:border-violet-500/40">
      {/* Real input kept for accessibility; the visible control is the [x]/[ ] glyph. */}
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 select-none font-mono text-sm leading-none transition-colors",
          checked ? "text-violet-300 phosphor-glow" : "text-white/30 group-hover:text-white/55",
        )}
      >
        {checked ? "[x]" : "[ ]"}
      </span>
      <div className="flex-1">
        <span className="font-mono text-sm font-medium text-white">{label}</span>
        {description && <p className="mt-0.5 font-mono text-xs text-white/40">{description}</p>}
      </div>
    </label>
  );
}
