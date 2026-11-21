import { describe, expect, it } from "vitest";
import {
  nextTheme,
  parseSaved,
  serializeSaved,
  shortcutAction,
  SHORTCUTS,
  type Saved,
} from "../src/persist";

const full: Saved = {
  goal: "bulk",
  sex: "female",
  age: 31,
  weight: 62,
  height: 168,
  activity: "active",
  budget: "7.5",
  days: 3,
  maxrepeat: "2",
  practical: true,
  excluded: ["egg", "rice"],
  theme: "dark",
};

describe("persistence", () => {
  it("round-trips a full state", () => {
    expect(parseSaved(serializeSaved(full))).toEqual(full);
  });
  it("returns nothing for null, garbage or non-objects", () => {
    for (const raw of [null, "", "{nope", "[1,2]", "42", "null"])
      expect(parseSaved(raw)).toEqual({});
  });
  it("drops invalid fields but keeps valid ones", () => {
    const got = parseSaved(
      JSON.stringify({
        goal: "teleport",
        sex: "male",
        age: "old",
        weight: Infinity,
        activity: "moderate",
        excluded: ["a", 3, null, "b"],
        theme: "neon",
        practical: "yes",
      }),
    );
    expect(got).toEqual({
      sex: "male",
      activity: "moderate",
      excluded: ["a", "b"],
    });
  });
});

describe("theme and shortcuts", () => {
  it("cycles through all three themes", () => {
    expect(nextTheme(nextTheme(nextTheme("auto")))).toBe("auto");
    expect(nextTheme("auto")).toBe("light");
  });
  it("maps keys to actions", () => {
    expect(shortcutAction("?", { tagName: "BODY" })).toBe("help");
    expect(shortcutAction("t", null)).toBe("theme");
    expect(shortcutAction("Escape", { tagName: "INPUT" })).toBe("close");
  });
  it("ignores typing in fields and modified keys", () => {
    expect(shortcutAction("t", { tagName: "input" })).toBeNull();
    expect(shortcutAction("r", { tagName: "SELECT" })).toBeNull();
    expect(shortcutAction("r", { tagName: "BODY" }, { ctrl: true })).toBeNull();
    expect(shortcutAction("x", null)).toBeNull();
  });
  it("documents every handled key", () => {
    for (const k of ["?", "t", "/", "r", "c"])
      expect(SHORTCUTS.some((s) => s.key === k)).toBe(true);
  });
});
