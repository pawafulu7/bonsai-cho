/**
 * OAuth Authentication Routes
 *
 * Implements GitHub and Google OAuth 2.0 with PKCE.
 * Uses Arctic library for OAuth handling.
 */

import { createClient } from "@libsql/client";
import { and, eq, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import {
  createGitHubAuthUrl,
  createGitHubProvider,
  createGoogleAuthUrl,
  createGoogleProvider,
  decodeGoogleIdToken,
  getGitHubEmail,
  getGitHubUser,
  type OAuthEnv,
  validateGitHubCode,
  validateGoogleCode,
  validateGoogleIdTokenClaims,
} from "@/lib/auth/arctic";
import {
  decrypt,
  encrypt,
  generateCodeVerifier,
  generateId,
  generateNonce,
  generateState,
} from "@/lib/auth/crypto";
import {
  clearCsrfCookie,
  createCsrfCookie,
  generateCsrfToken,
} from "@/lib/auth/csrf";
import {
  clearSessionCookie,
  createSession,
  createSessionCookie,
  type Database,
  deleteSessionById,
  getUserSessions,
  invalidateSession,
  parseSessionCookie,
  validateSession,
} from "@/lib/auth/session";
import * as schema from "@/lib/db/schema";

// Types
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  PUBLIC_APP_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
};

type Variables = {
  db: Database;
};

// OAuth state expiry (10 minutes)
const STATE_EXPIRES_MINUTES = 10;

// Create Hono app for auth routes
const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Database middleware
auth.use("*", async (c, next) => {
  const client = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });
  c.set("db", db as unknown as Database);
  await next();
});

/**
 * GET /api/auth/login/github
 * Initiates GitHub OAuth flow
 */
auth.get("/login/github", async (c) => {
  const db = c.get("db");
  const returnTo = c.req.query("returnTo") || "/";

  const env: OAuthEnv = {
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    PUBLIC_APP_URL: c.env.PUBLIC_APP_URL,
  };

  const provider = createGitHubProvider(env);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Encrypt code_verifier before storing
  const encryptedCodeVerifier = await encrypt(
    codeVerifier,
    c.env.SESSION_SECRET
  );

  // Store state in database
  const expiresAt = new Date(
    Date.now() + STATE_EXPIRES_MINUTES * 60 * 1000
  ).toISOString();
  await db.insert(schema.oauthStates).values({
    id: state,
    codeVerifier: encryptedCodeVerifier,
    provider: "github",
    returnTo,
    expiresAt,
  });

  // Create authorization URL
  const url = createGitHubAuthUrl(provider, state);

  // Set state cookie for additional verification
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  headers.append("Location", url.toString());

  return new Response(null, {
    status: 302,
    headers,
  });
});

/**
 * GET /api/auth/login/google
 * Initiates Google OAuth flow with PKCE
 */
auth.get("/login/google", async (c) => {
  const db = c.get("db");
  const returnTo = c.req.query("returnTo") || "/";

  const env: OAuthEnv = {
    GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
    GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    PUBLIC_APP_URL: c.env.PUBLIC_APP_URL,
  };

  const provider = createGoogleProvider(env);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const nonce = generateNonce();

  // Encrypt code_verifier before storing
  const encryptedCodeVerifier = await encrypt(
    codeVerifier,
    c.env.SESSION_SECRET
  );

  // Store state in database
  const expiresAt = new Date(
    Date.now() + STATE_EXPIRES_MINUTES * 60 * 1000
  ).toISOString();
  await db.insert(schema.oauthStates).values({
    id: state,
    codeVerifier: encryptedCodeVerifier,
    provider: "google",
    returnTo,
    nonce,
    expiresAt,
  });

  // Create authorization URL with PKCE
  const url = createGoogleAuthUrl(provider, state, codeVerifier);
  // Add nonce to URL for id_token verification
  url.searchParams.set("nonce", nonce);

  // Set state cookie for additional verification
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );
  headers.append("Location", url.toString());

  return new Response(null, {
    status: 302,
    headers,
  });
});

/**
 * GET /api/auth/callback/github
 * Handles GitHub OAuth callback
 */
auth.get("/callback/github", async (c) => {
  const db = c.get("db");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // Handle OAuth errors
  if (error) {
    console.error("GitHub OAuth error:", error);
    return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect("/login?error=missing_params");
  }

  // Verify state cookie
  const cookieHeader = c.req.header("Cookie") || "";
  const stateCookie = parseCookie(cookieHeader, "oauth_state");
  if (stateCookie !== state) {
    return c.redirect("/login?error=state_mismatch");
  }

  try {
    // Retrieve and validate stored state
    const now = new Date().toISOString();
    const storedState = await db
      .select()
      .from(schema.oauthStates)
      .where(
        and(
          eq(schema.oauthStates.id, state),
          eq(schema.oauthStates.provider, "github"),
          gt(schema.oauthStates.expiresAt, now)
        )
      )
      .limit(1);

    if (storedState.length === 0) {
      return c.redirect("/login?error=invalid_state");
    }

    const oauthState = storedState[0];
    const returnTo = oauthState.returnTo || "/";

    // Delete used state
    await db.delete(schema.oauthStates).where(eq(schema.oauthStates.id, state));

    // Decrypt code_verifier (not used for GitHub but stored for consistency)
    // const codeVerifier = await decrypt(oauthState.codeVerifier, c.env.SESSION_SECRET);

    // Exchange code for tokens
    const env: OAuthEnv = {
      GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      PUBLIC_APP_URL: c.env.PUBLIC_APP_URL,
    };
    const provider = createGitHubProvider(env);
    const tokens = await validateGitHubCode(provider, code);

    // Get user info
    const githubUser = await getGitHubUser(tokens.accessToken());
    const githubEmail = await getGitHubEmail(tokens.accessToken());

    if (!githubEmail) {
      return c.redirect("/login?error=email_required");
    }

    // Find or create user
    const { user } = await findOrCreateUser(db, {
      provider: "github",
      providerAccountId: String(githubUser.id),
      email: githubEmail.email,
      emailVerified: githubEmail.verified,
      name: githubUser.name || githubUser.login,
      avatarUrl: githubUser.avatar_url,
    });

    // Create session
    const { token } = await createSession(db, user.id);

    // Generate CSRF token
    const csrfToken = generateCsrfToken();

    // Set cookies and redirect
    const headers = new Headers();
    headers.append("Set-Cookie", createSessionCookie(token));
    headers.append("Set-Cookie", createCsrfCookie(csrfToken));
    headers.append(
      "Set-Cookie",
      "oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    );
    headers.append("Location", returnTo);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    console.error("GitHub callback error:", err);
    return c.redirect("/login?error=callback_failed");
  }
});

/**
 * GET /api/auth/callback/google
 * Handles Google OAuth callback
 */
auth.get("/callback/google", async (c) => {
  const db = c.get("db");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // Handle OAuth errors
  if (error) {
    console.error("Google OAuth error:", error);
    return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect("/login?error=missing_params");
  }

  // Verify state cookie
  const cookieHeader = c.req.header("Cookie") || "";
  const stateCookie = parseCookie(cookieHeader, "oauth_state");
  if (stateCookie !== state) {
    return c.redirect("/login?error=state_mismatch");
  }

  try {
    // Retrieve and validate stored state
    const now = new Date().toISOString();
    const storedState = await db
      .select()
      .from(schema.oauthStates)
      .where(
        and(
          eq(schema.oauthStates.id, state),
          eq(schema.oauthStates.provider, "google"),
          gt(schema.oauthStates.expiresAt, now)
        )
      )
      .limit(1);

    if (storedState.length === 0) {
      return c.redirect("/login?error=invalid_state");
    }

    const oauthState = storedState[0];
    const returnTo = oauthState.returnTo || "/";

    // Delete used state
    await db.delete(schema.oauthStates).where(eq(schema.oauthStates.id, state));

    // Decrypt code_verifier
    const codeVerifier = await decrypt(
      oauthState.codeVerifier,
      c.env.SESSION_SECRET
    );

    // Exchange code for tokens
    const env: OAuthEnv = {
      GITHUB_CLIENT_ID: c.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: c.env.GITHUB_CLIENT_SECRET,
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      PUBLIC_APP_URL: c.env.PUBLIC_APP_URL,
    };
    const provider = createGoogleProvider(env);
    const tokens = await validateGoogleCode(provider, code, codeVerifier);

    // Decode and validate ID token
    const idToken = tokens.idToken();
    const claims = decodeGoogleIdToken(idToken);

    // Validate claims
    const validation = validateGoogleIdTokenClaims(
      claims,
      c.env.GOOGLE_CLIENT_ID,
      oauthState.nonce || undefined
    );

    if (!validation.valid) {
      console.error("Google ID token validation failed:", validation.error);
      return c.redirect("/login?error=token_validation_failed");
    }

    // Find or create user
    const { user } = await findOrCreateUser(db, {
      provider: "google",
      providerAccountId: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      name: claims.name || claims.email.split("@")[0],
      avatarUrl: claims.picture,
    });

    // Create session
    const { token } = await createSession(db, user.id);

    // Generate CSRF token
    const csrfToken = generateCsrfToken();

    // Set cookies and redirect
    const headers = new Headers();
    headers.append("Set-Cookie", createSessionCookie(token));
    headers.append("Set-Cookie", createCsrfCookie(csrfToken));
    headers.append(
      "Set-Cookie",
      "oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    );
    headers.append("Location", returnTo);

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    console.error("Google callback error:", err);
    return c.redirect("/login?error=callback_failed");
  }
});

/**
 * POST /api/auth/logout
 * Logs out the current user
 */
auth.post("/logout", async (c) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (sessionToken) {
    await invalidateSession(db, sessionToken);
  }

  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearCsrfCookie());

  return c.json({ success: true }, { headers });
});

/**
 * GET /api/auth/me
 * Returns current user info
 */
auth.get("/me", async (c) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ user: null });
  }

  const result = await validateSession(db, sessionToken);

  if (!result) {
    return c.json({ user: null });
  }

  return c.json({ user: result.user });
});

/**
 * GET /api/auth/sessions
 * Returns all active sessions for current user
 */
auth.get("/sessions", async (c) => {
  const db = c.get("db");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await validateSession(db, sessionToken);

  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessions = await getUserSessions(db, result.user.id);

  return c.json({ sessions });
});

/**
 * DELETE /api/auth/sessions/:id
 * Deletes a specific session
 */
auth.delete("/sessions/:id", async (c) => {
  const db = c.get("db");
  const sessionId = c.req.param("id");
  const cookieHeader = c.req.header("Cookie") || "";
  const sessionToken = parseSessionCookie(cookieHeader);

  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await validateSession(db, sessionToken);

  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const deleted = await deleteSessionById(db, sessionId, result.user.id);

  if (!deleted) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ success: true });
});

// Helper functions

/**
 * Parse a specific cookie from cookie header
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split("=");
    if (cookieName === name) {
      return valueParts.join("=") || null;
    }
  }
  return null;
}

/**
 * Find existing user or create new one
 */
async function findOrCreateUser(
  db: Database,
  data: {
    provider: "github" | "google";
    providerAccountId: string;
    email: string;
    emailVerified: boolean;
    name: string;
    avatarUrl?: string | null;
  }
): Promise<{ user: typeof schema.users.$inferSelect; isNew: boolean }> {
  // First, check if OAuth account exists
  const existingOAuth = await db
    .select()
    .from(schema.oauthAccounts)
    .innerJoin(schema.users, eq(schema.oauthAccounts.userId, schema.users.id))
    .where(
      and(
        eq(schema.oauthAccounts.provider, data.provider),
        eq(schema.oauthAccounts.providerAccountId, data.providerAccountId)
      )
    )
    .limit(1);

  if (existingOAuth.length > 0) {
    // Update avatar if changed
    if (data.avatarUrl && existingOAuth[0].users.avatarUrl !== data.avatarUrl) {
      await db
        .update(schema.users)
        .set({ avatarUrl: data.avatarUrl, updatedAt: new Date().toISOString() })
        .where(eq(schema.users.id, existingOAuth[0].users.id));
    }
    return { user: existingOAuth[0].users, isNew: false };
  }

  // Check if user exists by email
  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, data.email))
    .limit(1);

  if (existingUser.length > 0) {
    // Link OAuth account to existing user
    await db.insert(schema.oauthAccounts).values({
      id: generateId(),
      userId: existingUser[0].id,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      email: data.email,
      emailVerified: data.emailVerified,
    });

    return { user: existingUser[0], isNew: false };
  }

  // Create new user
  const userId = generateId();
  const now = new Date().toISOString();

  await db.insert(schema.users).values({
    id: userId,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  // Create OAuth account
  await db.insert(schema.oauthAccounts).values({
    id: generateId(),
    userId,
    provider: data.provider,
    providerAccountId: data.providerAccountId,
    email: data.email,
    emailVerified: data.emailVerified,
  });

  const newUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return { user: newUser[0], isNew: true };
}

export default auth;
