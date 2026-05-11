"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ComboboxOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional colour dot shown before the label (hex). */
  color?: string;
}

export interface MultiComboboxProps<T extends string | number> {
  options: ComboboxOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  /** Text shown on the trigger when no options are selected. */
  triggerPlaceholder?: string;
}

/**
 * Searchable multi-select combobox. Built on our existing Popover primitive to
 * avoid pulling in cmdk; keyboard navigation is basic (focus stays in the
 * search input, arrow/Enter keys not wired) but sufficient for the tag picker.
 */
export function MultiCombobox<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyLabel = "No results",
  className,
  triggerPlaceholder = "Select…",
}: MultiComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedSet = React.useMemo(() => new Set(value), [value]);
  const selected = React.useMemo(
    () => options.filter((o) => selectedSet.has(o.value)),
    [options, selectedSet],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (v: T) => {
    if (selectedSet.has(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  const triggerLabel =
    selected.length === 0
      ? triggerPlaceholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full h-11 items-center justify-between gap-2 rounded-xl border px-4 text-sm text-white whitespace-nowrap transition-all outline-none",
            "bg-white/3 border-white/8",
            "hover:bg-white/5",
            "focus:bg-white/5 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20",
            selected.length === 0 && "text-white/40",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="relative p-2 border-b border-white/6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-9 pl-9 pr-8 text-sm"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-white/40">{emptyLabel}</div>
          ) : (
            filtered.map((opt) => {
              const isSelected = selectedSet.has(opt.value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm text-left",
                    "text-white/80 hover:bg-white/6 hover:text-white",
                    isSelected && "text-white",
                  )}
                >
                  <span className="flex-1 flex items-center gap-2 min-w-0">
                    {opt.color && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 text-purple-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {value.length > 0 && (
          <div className="border-t border-white/6 p-2 flex justify-between items-center text-xs">
            <span className="text-white/40">{value.length} selected</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-white/50 hover:text-white flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
