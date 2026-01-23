/**
 * Create Admin User Script
 *
 * Usage:
 *   export $(cat .env | grep -v '^#' | xargs) && pnpm exec tsx scripts/create-admin-user.ts
 *
 * Prompts for:
 *   - Email address
 *   - Name
 *   - Password (will be hashed with PBKDF2)
 */

import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createInterface } from "readline";
import { generateId } from "../src/lib/auth/crypto.ts";
import { hashPassword } from "../src/lib/auth/admin-session.ts";
import * as schema from "../src/lib/db/schema/index.ts";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  // Validate environment variables
  if (!process.env.TURSO_DATABASE_URL) {
    console.error("Error: TURSO_DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client, { schema });

  console.log("=== Create Admin User ===\n");

  const email = await question("Email: ");
  const name = await question("Name: ");
  const password = await question("Password: ");

  if (!email || !name || !password) {
    console.error("All fields are required");
    rl.close();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    rl.close();
    process.exit(1);
  }

  // Check if email already exists
  const existing = await db
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    console.error("Admin user with this email already exists");
    rl.close();
    process.exit(1);
  }

  // Create admin user
  const passwordHash = await hashPassword(password);
  const id = generateId();

  await db.insert(schema.adminUsers).values({
    id,
    email: email.toLowerCase().trim(),
    name,
    passwordHash,
  });

  console.log(`\nAdmin user created successfully!`);
  console.log(`  ID: ${id}`);
  console.log(`  Email: ${email.toLowerCase().trim()}`);
  console.log(`  Name: ${name}`);

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  rl.close();
  process.exit(1);
});
