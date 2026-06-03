import { cn } from "@/lib/utils";
import { SUPER_CATS, type SuperCat } from "@/lib/categories";

interface CategoryTabsProps {
  value: SuperCat;
  onChange: (cat: SuperCat) => void;
  counts?: Partial<Record<SuperCat, number>>;
  className?: string;
}

export function CategoryTabs({ value, onChange, counts, className }: CategoryTabsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {SUPER_CATS.map(({ key, label, emoji }) => {
        const count = counts?.[key];
        const isActive = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
              isActive
                ? "bg-[#0F1A2E] text-white border-[#0F1A2E] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <span>{emoji}</span>
            <span>{label}</span>
            {count !== undefined && (
              <span className={cn(
                "ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              )}>
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
