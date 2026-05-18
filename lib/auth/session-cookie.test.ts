import test from "node:test";
import assert from "node:assert/strict";
import {
  createFirebaseSessionCookie,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "./session-cookie";

test("createFirebaseSessionCookie exchanges the ID token for a long-lived session cookie", async () => {
  let receivedToken = "";
  let receivedExpiresIn = 0;

  const sessionCookie = await createFirebaseSessionCookie("id-token-123", {
    async createSessionCookie(idToken, options) {
      receivedToken = idToken;
      receivedExpiresIn = options.expiresIn;
      return "session-cookie-xyz";
    },
  });

  assert.equal(sessionCookie, "session-cookie-xyz");
  assert.equal(receivedToken, "id-token-123");
  assert.equal(receivedExpiresIn, SESSION_COOKIE_MAX_AGE_MS);
  assert.equal(SESSION_COOKIE_MAX_AGE_SECONDS, 14 * 24 * 60 * 60);
});
