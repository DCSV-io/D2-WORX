import { generateUsername } from "@d2/auth-domain";

/**
 * Ensures a user record has username and displayUsername fields.
 *
 * If no username is provided, generates one using `generateUsername()`.
 * If username is provided but displayUsername is missing, defaults
 * displayUsername to the username value.
 *
 * This hook runs inside `databaseHooks.user.create.before` to ensure
 * every user has a username before being persisted.
 */
export function ensureUsername(userData: Record<string, unknown>): Record<string, unknown> {
  if (!userData["username"]) {
    const { username, displayUsername } = generateUsername();
    return {
      ...userData,
      username,
      displayUsername,
    };
  }

  if (!userData["displayUsername"] && !userData["display_username"]) {
    return {
      ...userData,
      displayUsername: userData["username"],
    };
  }

  return userData;
}
