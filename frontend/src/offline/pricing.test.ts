import { describe, expect, it } from "vitest";
import cases from "../../../backend/tests/fixtures/scheme_cases.json";
import { money, quoteLine, type EngineItem } from "./pricing";
import type { Unit } from "../types";

describe("offline scheme engine matches the server engine", () => {
  for (const c of cases) {
    it(c.name, () => {
      const line = quoteLine(c.item as EngineItem, c.qty, c.unit as Unit, c.today);
      const { pieces, full_cases, reserved_cases, free_cases, free_earned, gross, discount, gst, total, errors, hint_data } = line;
      expect({ pieces, full_cases, reserved_cases, free_cases, free_earned, gross, discount, gst, total, errors, hint_data })
        .toEqual(c.expect);
    });
  }

  it("rounds half up to the paisa despite float noise", () => {
    expect(money(1.005)).toBe(1.01);
    expect(money(1772.1899999999998)).toBe(1772.19);
  });
});
