import { cookies } from "next/headers";
import { createHash, pbkdf2, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { ensureSchema } from "@/lib/schema";

const SESSION_COOKIE = "sv_session";
const SESSION_DAYS = 7;
const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

const pbkdf2Async = promisify(pbkdf2);

export type User = {
  id: string;
  email: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash?: string;
  password_hash?: string;
  createdAt?: string;
  created_at?: string;
};

export class AuthError extends Error {
  status = 400;
}

export class UnauthorizedError extends Error {
  status = 401;
}

export async function registerUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    throw new AuthError("Enter a valid email address.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  await ensureSchema();

  const passwordHash = await hashPassword(password);
  const sql = getSql();

  try {
    const rows = (await sql`
      INSERT INTO users (id, email, password_hash)
      VALUES (${randomUUID()}, ${normalizedEmail}, ${passwordHash})
      RETURNING id, email, created_at AS "createdAt"
    `) as UserRow[];

    return mapUser(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthError("An account with that email already exists.");
    }

    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  await ensureSchema();

  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash AS "passwordHash", created_at AS "createdAt"
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `) as UserRow[];

  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.passwordHash ?? user.password_hash ?? ""))) {
    throw new UnauthorizedError("Email or password is incorrect.");
  }

  return mapUser(user);
}

export async function createSession(userId: string) {
  await ensureSchema();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sql = getSql();

  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES (${randomUUID()}, ${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await ensureSchema();
    await getSql()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  await ensureSchema();

  const rows = (await getSql()`
    SELECT users.id, users.email, users.created_at AS "createdAt"
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${sha256(token)}
      AND sessions.expires_at > now()
    LIMIT 1
  `) as UserRow[];

  if (!rows[0]) {
    return null;
  }

  return mapUser(rows[0]);
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError("Sign in to continue.");
  }

  return user;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await pbkdf2Async(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST,
  );

  return `pbkdf2-${PASSWORD_DIGEST}$${PASSWORD_ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationText, saltText, hashText] = encoded.split("$");

  if (algorithm !== `pbkdf2-${PASSWORD_DIGEST}` || !iterationText || !saltText || !hashText) {
    return false;
  }

  const iterations = Number(iterationText);
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  const actual = await pbkdf2Async(password, salt, iterations, expected.length, PASSWORD_DIGEST);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
