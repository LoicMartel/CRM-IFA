import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingSessionLocation } from "./training-session-location";

describe("missingSessionLocation", () => {
  it("blocks a journee without any address", () => {
    assert.equal(missingSessionLocation("journee", ""), true);
    assert.equal(missingSessionLocation("journee", null), true);
    assert.equal(missingSessionLocation("journee", undefined), true);
  });

  it("blocks a journee whose address is only whitespace", () => {
    assert.equal(missingSessionLocation("journee", "   "), true);
  });

  it("accepts a journee with a real address", () => {
    assert.equal(missingSessionLocation("journee", "22 Rue Picot, 83000 Toulon"), false);
  });

  it("never requires an address on a VT (remote session)", () => {
    assert.equal(missingSessionLocation("vt", ""), false);
    assert.equal(missingSessionLocation("vt", null), false);
  });
});
