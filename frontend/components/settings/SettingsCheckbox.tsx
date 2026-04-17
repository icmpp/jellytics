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
    <label className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors cursor-pointer">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded bg-white/3 border-white/15 text-purple-500 focus:ring-2 focus:ring-purple-500/30"
      />
      <div className="flex-1">
        <span className="text-sm font-medium text-white">{label}</span>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}
