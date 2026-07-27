import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSystemSender, shouldSkipScoring } from "./upstream-filter";

describe("isSystemSender", () => {
  it("catches the bounce that comes back when the agent mails an invalid address", () => {
    assert.equal(isSystemSender("mailer-daemon@kundenserver.de"), true);
    assert.equal(isSystemSender("postmaster@orange.fr"), true);
    assert.equal(isSystemSender("no-reply@stripe.com"), true);
  });

  it("never drops a human who writes from a generic company box", () => {
    assert.equal(isSystemSender("marketing@prospect.fr"), false);
    assert.equal(isSystemSender("newsletter@prospect.fr"), false);
    assert.equal(isSystemSender("contact@prospect.fr"), false);
  });

  it("leaves chat handles alone (no '@' → phone / social id)", () => {
    assert.equal(isSystemSender("+33612345678"), false);
    assert.equal(isSystemSender(null), false);
  });
});

describe("shouldSkipScoring", () => {
  it("still silences the wider noise set (marketing/newsletter/internal)", () => {
    assert.equal(shouldSkipScoring("marketing@acme.com", "Promo", "body"), true);
    assert.equal(shouldSkipScoring("rafi@closing-academie.com", "RE", "body"), true);
    assert.equal(shouldSkipScoring("hello@acme.com", "News", "Pour ne plus recevoir nos emails"), true);
  });

  it("lets a real lead through", () => {
    assert.equal(shouldSkipScoring("kamel@outlook.fr", "Renseignements", "Bonjour, je cherche une formation"), false);
  });
});
