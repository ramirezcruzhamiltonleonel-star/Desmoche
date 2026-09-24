import { containsOffensiveContent } from "./contentFilter";

describe("containsOffensiveContent", () => {
  it("is false for an ordinary, harmless reto", () => {
    expect(containsOffensiveContent("Cantar el himno nacional al revés")).toBe(false);
  });

  it("catches an obvious banned word, case-insensitively", () => {
    expect(containsOffensiveContent("Sos un PENDEJO")).toBe(true);
  });

  it("catches a banned word regardless of accents", () => {
    expect(containsOffensiveContent("qué cabrón sos")).toBe(true);
  });

  it("catches a banned word embedded inside a longer sentence", () => {
    expect(containsOffensiveContent("Bailar como un idiota frente a todos")).toBe(true);
  });

  it("is false for an empty string", () => {
    expect(containsOffensiveContent("")).toBe(false);
  });
});
