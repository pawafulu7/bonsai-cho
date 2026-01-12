/**
 * Arctic OAuth provider configuration
 *
 * Supports GitHub and Google OAuth 2.0 with PKCE
 */

import * as arctic from "arctic";

export type OAuthProvider = "github" | "google";

/**
 * Environment bindings for OAuth configuration
 */
export interface OAuthEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  PUBLIC_APP_URL: string;
}

/**
 * Create GitHub OAuth provider instance
 */
export function createGitHubProvider(env: OAuthEnv): arctic.GitHub {
  const redirectUri = `${env.PUBLIC_APP_URL}/api/auth/callback/github`;
  return new arctic.GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    redirectUri
  );
}

/**
 * Create Google OAuth provider instance
 */
export function createGoogleProvider(env: OAuthEnv): arctic.Google {
  const redirectUri = `${env.PUBLIC_APP_URL}/api/auth/callback/google`;
  return new arctic.Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

/**
 * GitHub OAuth scopes
 * - user:email: Access user's email addresses (including private)
 */
export const GITHUB_SCOPES = ["user:email"];

/**
 * Google OAuth scopes (OpenID Connect)
 * - openid: Required for OIDC
 * - email: Access user's email
 * - profile: Access user's profile info
 */
export const GOOGLE_SCOPES = ["openid", "email", "profile"];

/**
 * Create authorization URL for GitHub
 */
export function createGitHubAuthUrl(
  provider: arctic.GitHub,
  state: string
): URL {
  return provider.createAuthorizationURL(state, GITHUB_SCOPES);
}

/**
 * Create authorization URL for Google with PKCE
 */
export function createGoogleAuthUrl(
  provider: arctic.Google,
  state: string,
  codeVerifier: string
): URL {
  return provider.createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES);
}

/**
 * Validate GitHub authorization code
 */
export async function validateGitHubCode(
  provider: arctic.GitHub,
  code: string
): Promise<arctic.OAuth2Tokens> {
  return provider.validateAuthorizationCode(code);
}

/**
 * Validate Google authorization code with PKCE
 */
export async function validateGoogleCode(
  provider: arctic.Google,
  code: string,
  codeVerifier: string
): Promise<arctic.OAuth2Tokens> {
  return provider.validateAuthorizationCode(code, codeVerifier);
}

/**
 * GitHub user info from API
 */
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

/**
 * GitHub email from API
 */
export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

/**
 * Fetch GitHub user info
 */
export async function getGitHubUser(
  accessToken: string
): Promise<GitHubUser> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Bonsai-Cho",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch GitHub user emails
 * Returns the primary verified email
 */
export async function getGitHubEmail(
  accessToken: string
): Promise<{ email: string; verified: boolean } | null> {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Bonsai-Cho",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const emails: GitHubEmail[] = await response.json();

  // Find primary verified email
  const primaryEmail = emails.find((e) => e.primary && e.verified);
  if (primaryEmail) {
    return { email: primaryEmail.email, verified: true };
  }

  // Fallback to any verified email
  const verifiedEmail = emails.find((e) => e.verified);
  if (verifiedEmail) {
    return { email: verifiedEmail.email, verified: true };
  }

  return null;
}

/**
 * Google ID token claims (decoded)
 */
export interface GoogleIdTokenClaims {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  nonce?: string;
}

/**
 * Decode and validate Google ID token claims
 *
 * Note: Arctic's decodeIdToken only decodes, it doesn't verify the signature.
 * For production, you should verify the token with Google's public keys.
 * However, since we receive the token directly from Google's token endpoint
 * over HTTPS, it's considered safe for basic use cases.
 */
export function decodeGoogleIdToken(idToken: string): GoogleIdTokenClaims {
  return arctic.decodeIdToken(idToken) as GoogleIdTokenClaims;
}

/**
 * Validate Google ID token claims
 */
export function validateGoogleIdTokenClaims(
  claims: GoogleIdTokenClaims,
  expectedClientId: string,
  expectedNonce?: string
): { valid: boolean; error?: string } {
  // Validate issuer
  if (
    claims.iss !== "https://accounts.google.com" &&
    claims.iss !== "accounts.google.com"
  ) {
    return { valid: false, error: "Invalid issuer" };
  }

  // Validate audience
  if (claims.aud !== expectedClientId) {
    return { valid: false, error: "Invalid audience" };
  }

  // Validate nonce if provided
  if (expectedNonce && claims.nonce !== expectedNonce) {
    return { valid: false, error: "Invalid nonce" };
  }

  // Check email_verified
  if (!claims.email_verified) {
    return { valid: false, error: "Email not verified" };
  }

  return { valid: true };
}

// Re-export Arctic types and utilities
export { arctic };
export type { OAuth2Tokens } from "arctic";
