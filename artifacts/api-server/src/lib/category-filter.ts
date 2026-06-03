export const SUPER_CATEGORY_MAP: Record<string, string[]> = {
  phones: ["Smartphone"],
  computers: ["Laptop", "Laptop Accessories", "Tablet", "Gaming", "Gaming Accessories"],
  accessories: ["Phone Accessories", "Smartwatches", "Audio", "Cameras", "Camera Accessories", "Others"],
};

export type SuperCategory = keyof typeof SUPER_CATEGORY_MAP;

export function getCategoriesForSuper(superCategory: string | undefined): string[] | undefined {
  if (!superCategory || superCategory === "all") return undefined;
  const cats = SUPER_CATEGORY_MAP[superCategory];
  return cats?.length ? cats : undefined;
}

export function getSuperCategory(category: string): string {
  for (const [super_, cats] of Object.entries(SUPER_CATEGORY_MAP)) {
    if (cats.includes(category)) return super_;
  }
  return "accessories";
}
