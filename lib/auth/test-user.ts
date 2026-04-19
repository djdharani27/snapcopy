import { getAdminAuth } from "@/lib/firebase/admin";
import { upsertUserProfile } from "@/lib/firebase/firestore-admin";
import {
  TEST_USER_EMAIL,
  TEST_USER_NAME,
  TEST_USER_PASSWORD,
} from "@/lib/auth/test-user-credentials";

export async function ensureSeededTestUser() {
  const adminAuth = getAdminAuth();

  const existingUser = await adminAuth
    .getUserByEmail(TEST_USER_EMAIL)
    .catch((error: { code?: string }) => {
      if (error.code === "auth/user-not-found") {
        return null;
      }

      throw error;
    });

  const authUser = existingUser
    ? await adminAuth.updateUser(existingUser.uid, {
        displayName: TEST_USER_NAME,
        password: TEST_USER_PASSWORD,
        emailVerified: true,
        disabled: false,
      })
    : await adminAuth.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        displayName: TEST_USER_NAME,
        emailVerified: true,
      });

  await adminAuth.setCustomUserClaims(authUser.uid, {
    ...(existingUser?.customClaims ?? {}),
    testAccount: true,
  });

  await upsertUserProfile({
    uid: authUser.uid,
    name: TEST_USER_NAME,
    email: TEST_USER_EMAIL,
    role: "customer",
    isTestAccount: true,
  });

  return authUser;
}
