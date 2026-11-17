import raw from "./data/foods.json";
import { NUTRIENTS, type Food } from "./diet";

export type Aisle =
  | "grains"
  | "bakery"
  | "produce"
  | "legumes"
  | "chilled"
  | "frozen"
  | "meat"
  | "pantry";

export const AISLES: Aisle[] = [
  "grains",
  "bakery",
  "produce",
  "legumes",
  "chilled",
  "frozen",
  "meat",
  "pantry",
];

export interface CatalogFood extends Food {
  aisle: Aisle;
  vegan: boolean;
}

/** Validate untyped data; throws with a message naming the offending food. */
export function parseFoods(data: unknown): CatalogFood[] {
  if (!Array.isArray(data)) throw new Error("foods must be an array");
  const seen = new Set<string>();
  return data.map((item: unknown, i) => {
    const f = item as Partial<CatalogFood> | null;
    const where = `food #${i}${f?.id ? ` (${f.id})` : ""}`;
    if (!f || typeof f !== "object") throw new Error(`${where}: not an object`);
    if (typeof f.id !== "string" || !/^[a-z0-9-]+$/.test(f.id))
      throw new Error(`${where}: bad id`);
    if (seen.has(f.id)) throw new Error(`${where}: duplicate id`);
    seen.add(f.id);
    if (typeof f.name !== "string" || !f.name)
      throw new Error(`${where}: name`);
    if (!AISLES.includes(f.aisle as Aisle)) throw new Error(`${where}: aisle`);
    if (typeof f.vegan !== "boolean") throw new Error(`${where}: vegan`);
    if (typeof f.price !== "number" || !(f.price > 0))
      throw new Error(`${where}: price must be > 0`);
    if (typeof f.maxGrams !== "number" || !(f.maxGrams > 0))
      throw new Error(`${where}: maxGrams must be > 0`);
    for (const n of NUTRIENTS) {
      const v = f.per100g?.[n];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        throw new Error(`${where}: nutrient ${n} must be a number >= 0`);
    }
    return f as CatalogFood;
  });
}

export const FOODS: CatalogFood[] = parseFoods(raw);
