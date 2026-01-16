/**
 * Likes API Routes
 *
 * Handles like/unlike functionality for bonsai posts.
 * Implements idempotent operations and counter updates.
 */

import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import { generateId } from "@/lib/auth/crypto";
import { parseCsrfCookie, validateCsrfToken } from "@/lib/auth/csrf";
import { parseSessionCookie, validateSession } from "@/lib/auth/session";
import { type Database, getDb } from "@/lib/db/client";
import { decodeCursor, encodeCursor, notDeleted } from "@/lib/db/helpers";
import * as schema from "@/lib/db/schema";

import {
	type LikeListResponse,
	type LikeResponse,
	type UserSummary,
	bonsaiIdParamSchema,
	paginationQuerySchema,
} from "./social.schema";

// Types
type Bindings = {
	TURSO_DATABASE_URL: string;
	TURSO_AUTH_TOKEN: string;
	PUBLIC_APP_URL: string;
	SESSION_SECRET: string;
};

type Variables = {
	db: Database;
	userId: string | null;
};

// Create Hono app for likes routes
const likes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ============================================================================
// Middleware
// ============================================================================

// Database middleware
likes.use("*", async (c, next) => {
	const db = await getDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
	c.set("db", db);
	await next();
});

// Optional auth middleware - sets userId if authenticated, null otherwise
likes.use("*", async (c, next) => {
	const db = c.get("db");
	const cookieHeader = c.req.header("Cookie") || "";
	const sessionToken = parseSessionCookie(cookieHeader);

	if (sessionToken) {
		const result = await validateSession(db, sessionToken);
		if (result) {
			c.set("userId", result.user.id);
			await next();
			return;
		}
	}

	c.set("userId", null);
	await next();
});

// CSRF middleware for mutation requests
const csrfMiddleware = async (
	c: Parameters<Parameters<typeof likes.use>[1]>[0],
	next: () => Promise<void>,
) => {
	const method = c.req.method;
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
		return next();
	}

	const cookieHeader = c.req.header("Cookie") || "";
	const csrfCookie = parseCsrfCookie(cookieHeader);
	const csrfHeader = c.req.header("X-CSRF-Token") ?? null;

	if (!validateCsrfToken(csrfCookie, csrfHeader)) {
		return c.json({ error: "Invalid CSRF token" }, 403);
	}

	return next();
};

likes.use("*", csrfMiddleware);

// Helper function to require authentication
function requireAuth(userId: string | null): userId is string {
	return userId !== null;
}

// ============================================================================
// Helper: Verify bonsai access
// ============================================================================

async function verifyBonsaiAccess(
	db: Database,
	bonsaiId: string,
	userId: string | null,
): Promise<
	| { allowed: true; bonsai: { id: string; userId: string; isPublic: boolean } }
	| { allowed: false; status: 404 }
> {
	const [targetBonsai] = await db
		.select({
			id: schema.bonsai.id,
			userId: schema.bonsai.userId,
			isPublic: schema.bonsai.isPublic,
		})
		.from(schema.bonsai)
		.where(and(eq(schema.bonsai.id, bonsaiId), notDeleted(schema.bonsai)))
		.limit(1);

	if (!targetBonsai) {
		return { allowed: false, status: 404 };
	}

	// Non-public bonsai: only owner can access
	if (!targetBonsai.isPublic && targetBonsai.userId !== userId) {
		return { allowed: false, status: 404 };
	}

	return { allowed: true, bonsai: targetBonsai };
}

// ============================================================================
// Helper: Update like count
// ============================================================================

async function updateLikeCount(db: Database, bonsaiId: string): Promise<number> {
	// Use subquery to get accurate count (prevents race conditions)
	const [result] = await db
		.update(schema.bonsai)
		.set({
			likeCount: sql`(SELECT COUNT(*) FROM ${schema.likes} WHERE ${schema.likes.bonsaiId} = ${bonsaiId})`,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(schema.bonsai.id, bonsaiId))
		.returning({ likeCount: schema.bonsai.likeCount });

	return result?.likeCount ?? 0;
}

// ============================================================================
// POST /api/bonsai/:bonsaiId/likes - Add like
// ============================================================================

likes.post("/:bonsaiId/likes", async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");

	// Require authentication
	if (!requireAuth(userId)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	// Validate bonsaiId
	const paramResult = bonsaiIdParamSchema.safeParse({
		bonsaiId: c.req.param("bonsaiId"),
	});

	if (!paramResult.success) {
		return c.json(
			{
				error: "Invalid bonsai ID",
				details: paramResult.error.flatten().fieldErrors,
			},
			400,
		);
	}

	const { bonsaiId } = paramResult.data;

	// Verify bonsai access
	const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
	if (!accessResult.allowed) {
		return c.json({ error: "Bonsai not found" }, 404);
	}

	try {
		// Insert like (idempotent - ignore if already exists)
		await db
			.insert(schema.likes)
			.values({
				id: generateId(),
				userId,
				bonsaiId,
				createdAt: new Date().toISOString(),
			})
			.onConflictDoNothing();

		// Update like count
		const likeCount = await updateLikeCount(db, bonsaiId);

		const response: LikeResponse = {
			liked: true,
			likeCount,
		};

		return c.json(response, 201);
	} catch (error) {
		console.error("Error adding like:", error);
		return c.json({ error: "Failed to add like" }, 500);
	}
});

// ============================================================================
// DELETE /api/bonsai/:bonsaiId/likes - Remove like
// ============================================================================

likes.delete("/:bonsaiId/likes", async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");

	// Require authentication
	if (!requireAuth(userId)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	// Validate bonsaiId
	const paramResult = bonsaiIdParamSchema.safeParse({
		bonsaiId: c.req.param("bonsaiId"),
	});

	if (!paramResult.success) {
		return c.json(
			{
				error: "Invalid bonsai ID",
				details: paramResult.error.flatten().fieldErrors,
			},
			400,
		);
	}

	const { bonsaiId } = paramResult.data;

	// Verify bonsai access
	const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
	if (!accessResult.allowed) {
		return c.json({ error: "Bonsai not found" }, 404);
	}

	try {
		// Delete like (idempotent - no error if doesn't exist)
		await db
			.delete(schema.likes)
			.where(
				and(eq(schema.likes.userId, userId), eq(schema.likes.bonsaiId, bonsaiId)),
			);

		// Update like count
		const likeCount = await updateLikeCount(db, bonsaiId);

		const response: LikeResponse = {
			liked: false,
			likeCount,
		};

		return c.json(response, 200);
	} catch (error) {
		console.error("Error removing like:", error);
		return c.json({ error: "Failed to remove like" }, 500);
	}
});

// ============================================================================
// GET /api/bonsai/:bonsaiId/likes - List users who liked
// ============================================================================

likes.get("/:bonsaiId/likes", async (c) => {
	const db = c.get("db");
	const userId = c.get("userId");

	// Validate bonsaiId
	const paramResult = bonsaiIdParamSchema.safeParse({
		bonsaiId: c.req.param("bonsaiId"),
	});

	if (!paramResult.success) {
		return c.json(
			{
				error: "Invalid bonsai ID",
				details: paramResult.error.flatten().fieldErrors,
			},
			400,
		);
	}

	const { bonsaiId } = paramResult.data;

	// Parse query parameters
	const queryResult = paginationQuerySchema.safeParse({
		cursor: c.req.query("cursor"),
		limit: c.req.query("limit"),
	});

	if (!queryResult.success) {
		return c.json(
			{
				error: "Invalid query parameters",
				details: queryResult.error.flatten().fieldErrors,
			},
			400,
		);
	}

	const { cursor, limit } = queryResult.data;

	// Verify bonsai access
	const accessResult = await verifyBonsaiAccess(db, bonsaiId, userId);
	if (!accessResult.allowed) {
		return c.json({ error: "Bonsai not found" }, 404);
	}

	// Decode cursor if provided
	let cursorData: { createdAt: string; id: string } | null = null;
	if (cursor) {
		cursorData = decodeCursor(cursor);
		if (!cursorData) {
			return c.json({ error: "Invalid cursor" }, 400);
		}
	}

	try {
		// Build cursor condition
		const cursorCondition = cursorData
			? or(
					lt(schema.likes.createdAt, cursorData.createdAt),
					and(
						eq(schema.likes.createdAt, cursorData.createdAt),
						lt(schema.likes.id, cursorData.id),
					),
				)
			: undefined;

		// Fetch likes with user info
		const results = await db
			.select({
				id: schema.likes.id,
				createdAt: schema.likes.createdAt,
				user: {
					id: schema.users.id,
					name: schema.users.name,
					displayName: schema.users.displayName,
					avatarUrl: schema.users.avatarUrl,
				},
			})
			.from(schema.likes)
			.innerJoin(schema.users, eq(schema.likes.userId, schema.users.id))
			.where(
				and(
					eq(schema.likes.bonsaiId, bonsaiId),
					isNull(schema.users.deletedAt),
					cursorCondition,
				),
			)
			.orderBy(desc(schema.likes.createdAt), desc(schema.likes.id))
			.limit(limit + 1);

		// Check if there are more results
		const hasMore = results.length > limit;
		const data = hasMore ? results.slice(0, limit) : results;

		// Get total count
		const [countResult] = await db
			.select({ total: count() })
			.from(schema.likes)
			.where(eq(schema.likes.bonsaiId, bonsaiId));

		// Check if current user has liked
		let isLiked = false;
		if (userId) {
			const [userLike] = await db
				.select({ id: schema.likes.id })
				.from(schema.likes)
				.where(
					and(eq(schema.likes.userId, userId), eq(schema.likes.bonsaiId, bonsaiId)),
				)
				.limit(1);
			isLiked = !!userLike;
		}

		// Generate next cursor
		const nextCursor =
			hasMore && data.length > 0
				? encodeCursor({
						createdAt: data[data.length - 1].createdAt,
						id: data[data.length - 1].id,
					})
				: null;

		const response: LikeListResponse = {
			data: data.map((item) => item.user as UserSummary),
			total: countResult?.total ?? 0,
			isLiked,
			nextCursor,
			hasMore,
		};

		return c.json(response, 200);
	} catch (error) {
		console.error("Error listing likes:", error);
		return c.json({ error: "Failed to list likes" }, 500);
	}
});

export default likes;
