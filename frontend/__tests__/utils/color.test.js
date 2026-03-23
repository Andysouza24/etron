import { sanitizeHexColor, isValidHexColor } from "../../utils/color";

describe("sanitizeHexColor", () => {
  it("adds a leading hash and uppercases the value", () => {
    expect(sanitizeHexColor("ff7043")).toBe("#FF7043");
  });

  it("preserves an existing hash", () => {
    expect(sanitizeHexColor("#123abc")).toBe("#123ABC");
  });

  it("expands shorthand values", () => {
    expect(sanitizeHexColor("#0af")).toBe("#00AAFF");
  });

  it("returns an empty string for invalid input", () => {
    expect(sanitizeHexColor("xyz")).toBe("");
  });
});

describe("isValidHexColor", () => {
  it("accepts standard six digit colours", () => {
    expect(isValidHexColor("#1A73E8")).toBe(true);
  });

  it("accepts shorthand colours", () => {
    expect(isValidHexColor("#0AF")).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(isValidHexColor("123456")).toBe(false);
  });
});
