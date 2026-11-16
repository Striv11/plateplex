import { planDiet } from "./diet";
import { STARTER_FOODS } from "./foods";

const out = document.getElementById("out");
if (out) {
  const plan = planDiet(STARTER_FOODS, {
    kcal: { min: 2000, max: 2200 },
    protein: { min: 100 },
    fiber: { min: 30 },
    sodium: { max: 2300 },
  });
  const lines = STARTER_FOODS.filter((f) => plan.grams[f.id]).map(
    (f) => `${f.name.padEnd(20)} ${Math.round(plan.grams[f.id] ?? 0)} g`,
  );
  out.textContent = `${plan.status}: $${plan.cost.toFixed(2)}/day\n${lines.join("\n")}`;
}
