type SessionCookieAuth = {
  createSessionCookie(idToken: string, options: { expiresIn: number }): Promise<string>;
};

export const SESSION_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_COOKIE_MAX_AGE_MS / 1000;

export async function createFirebaseSessionCookie(
  idToken: string,
  auth: SessionCookieAuth,
) {
  return auth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
}
