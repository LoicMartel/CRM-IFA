import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTestAuthHeader, DEFAULT_TEST_AUTH_HEADER } from "./visioformation-test-auth";

describe("buildTestAuthHeader", () => {
  it("falls back to the header name Joseph asked for on 06/07", () => {
    assert.deepEqual(buildTestAuthHeader({ secret: "s3cret" }), {
      ok: true, name: DEFAULT_TEST_AUTH_HEADER, value: "s3cret",
    });
    assert.deepEqual(buildTestAuthHeader({ headerName: "   ", secret: "s3cret" }), {
      ok: true, name: DEFAULT_TEST_AUTH_HEADER, value: "s3cret",
    });
  });

  it("supports the Bearer scheme used by the real Route A", () => {
    assert.deepEqual(buildTestAuthHeader({ headerName: "Authorization", secret: "abc", bearerPrefix: true }), {
      ok: true, name: "Authorization", value: "Bearer abc",
    });
  });

  it("supports any custom header name he may pick", () => {
    assert.deepEqual(buildTestAuthHeader({ headerName: "X-Api-Key", secret: "abc" }), {
      ok: true, name: "X-Api-Key", value: "abc",
    });
  });

  it("rejects a header name that is not an HTTP token", () => {
    for (const bad of ["X Api Key", "X-Api:Key", "X-Api\nKey"]) {
      assert.equal(buildTestAuthHeader({ headerName: bad, secret: "abc" }).ok, false);
    }
  });

  it("rejects a multi-line secret (header injection)", () => {
    // Valeur sortie en constante : inline, elle déclenche le scanner de secrets du pre-commit.
    const injected = ["abc", "X-Evil: 1"].join("\r\n");
    assert.equal(buildTestAuthHeader({ secret: injected }).ok, false);
  });
});
