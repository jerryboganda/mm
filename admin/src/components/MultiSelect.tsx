import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
}

export default function MultiSelect({
  label,
  options,
  values,
  onChange,
  placeholder = "Any",
  searchable = false,
  className = "",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-sm outline-none transition-colors w-full justify-between ${
          values.length > 0
            ? "border-primary-400 bg-primary-50 text-primary-700 font-medium"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className="truncate">
          {label}
          {values.length > 0 ? ` · ${values.length}` : ""}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {values.length > 0 && (
            <X
              className="w-3.5 h-3.5"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            />
          )}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[220px] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
          {searchable && (
            <div className="relative mb-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-2 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-2">{placeholder}</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50 text-left"
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  values.includes(o.value)
                    ? "bg-primary-600 border-primary-600"
                    : "border-gray-300"
                }`}
              >
                {values.includes(o.value) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </span>
              <span className="truncate">{o.label}</span>
              {o.hint && (
                <span className="ml-auto text-xs text-gray-400">{o.hint}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
