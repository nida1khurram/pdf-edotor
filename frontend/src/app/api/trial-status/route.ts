import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TRIAL_DAYS = 7;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ authenticated: false, expired: false, daysLeft: 0 });
  }

  const { rows } = await pool.query(
    'SELECT "createdAt" FROM "User" WHERE "id" = $1',
    [session.user.id]
  );

  const createdAt = rows[0]?.createdAt;
  if (!createdAt) {
    return Response.json({ authenticated: true, expired: false, daysLeft: TRIAL_DAYS });
  }

  const trialEndsAt = new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const expired = now > trialEndsAt;
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return Response.json({ authenticated: true, expired, daysLeft, trialEndsAt });
}
