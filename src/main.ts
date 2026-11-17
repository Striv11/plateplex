import { planDiet } from "./diet";
import { FOODS } from "./dataset";
import { presetTargets } from "./targets";

const out = document.getElementById("out");
if (out) {
  const plan = planDiet(
    FOODS,
    presetTargets("maintain", {
      sex: "male",
      age: 30,
      weightKg: 80,
      heightCm: 180,
      activity: "moderate",
    }),
  );
  const lines = FOODS.filter((f) => plan.grams[f.id]).map(
    (f) => `${f.name.padEnd(20)} ${Math.round(plan.grams[f.id] ?? 0)} g`,
  );
  out.textContent = `${plan.status}: $${plan.cost.toFixed(2)}/day\n${lines.join("\n")}`;
}
