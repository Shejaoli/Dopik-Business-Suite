import { useState, useEffect } from "react";

export const SUPER_CATEGORY_MAP: Record<string, string[]> = {
  phones: ["Smartphone"],
  computers: ["Laptop", "Laptop Accessories", "Tablet", "Gaming", "Gaming Accessories"],
  accessories: ["Phone Accessories", "Smartwatches", "Audio", "Cameras", "Camera Accessories", "Others"],
};

export type SuperCat = "all" | "phones" | "computers" | "accessories";

export const SUPER_CATS: { key: SuperCat; label: string; emoji: string; color: string; border: string }[] = [
  { key: "all",         label: "All",         emoji: "📦", color: "bg-gray-600",   border: "border-l-gray-400" },
  { key: "phones",      label: "Phones",      emoji: "📱", color: "bg-blue-600",   border: "border-l-blue-500" },
  { key: "computers",   label: "Computers",   emoji: "💻", color: "bg-purple-600", border: "border-l-purple-500" },
  { key: "accessories", label: "Accessories", emoji: "🎧", color: "bg-green-600",  border: "border-l-green-500" },
];

export function getSuperCategory(category: string): SuperCat {
  for (const [super_, cats] of Object.entries(SUPER_CATEGORY_MAP)) {
    if (cats.includes(category)) return super_ as SuperCat;
  }
  return "accessories";
}

export function getCatsForSuper(superCat: SuperCat): string[] | undefined {
  if (superCat === "all") return undefined;
  return SUPER_CATEGORY_MAP[superCat];
}

export function matchesSuperCat(category: string, superCat: SuperCat): boolean {
  if (superCat === "all") return true;
  const cats = getCatsForSuper(superCat);
  return cats ? cats.includes(category) : true;
}

export function getCategoryEmoji(category: string): string {
  const s = getSuperCategory(category);
  return SUPER_CATS.find(c => c.key === s)?.emoji ?? "📦";
}

export function useCategoryTab(storageKey: string, defaultCat: SuperCat = "all") {
  const [cat, setCatState] = useState<SuperCat>(() => {
    try {
      const stored = localStorage.getItem(`cat_tab_${storageKey}`);
      if (stored && ["all", "phones", "computers", "accessories"].includes(stored)) {
        return stored as SuperCat;
      }
    } catch {}
    return defaultCat;
  });

  const setCat = (c: SuperCat) => {
    setCatState(c);
    try { localStorage.setItem(`cat_tab_${storageKey}`, c); } catch {}
  };

  return [cat, setCat] as const;
}
