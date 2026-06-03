// Re-verifies the current user's password before sensitive actions.
// Works by re-running signIn; an "already authenticated" error also means success.

import { getCurrentUser, signIn } from "aws-amplify/auth";


export async function verifyPassword(password) {
  try {
    const user = await getCurrentUser();
    const loginId = user?.signInDetails?.loginId;

    if (!loginId) {
      console.error("No loginId found for current user.");
      return false;
    }

    // if sign in fails because user already authenticated, password is correct
    await signIn(loginId, password);
    console.log("Password is correct (signIn successful)");
    return true;

  } catch (error) {
    if (error.name === "UserAlreadyAuthenticatedException") {
      console.log("Password is correct (already signed in)");
      return true;
    }

    console.error("Incorrect password:", error);
    return false;
  }
}
