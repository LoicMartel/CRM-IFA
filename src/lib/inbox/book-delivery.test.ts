import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldUseResendBookFallback } from "./book-delivery";

describe("shouldUseResendBookFallback", () => {
  it("uses the legacy book delivery when Adam could not deliver a new book lead", () => {
    assert.equal(shouldUseResendBookFallback({
      isBookSource: true,
      isNewConversation: true,
      deliveredByAdam: false,
    }), true);
  });

  it("does not duplicate the book once Adam delivered it", () => {
    assert.equal(shouldUseResendBookFallback({
      isBookSource: true,
      isNewConversation: true,
      deliveredByAdam: true,
    }), false);
  });

  it("does not resend the book on a repeated submission", () => {
    assert.equal(shouldUseResendBookFallback({
      isBookSource: true,
      isNewConversation: false,
      deliveredByAdam: false,
    }), false);
  });
});
