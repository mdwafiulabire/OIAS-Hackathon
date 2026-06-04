import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, organization } from 'better-auth/plugins';
import { env } from '../../../env.js';
import { createDb, organisations as orgsTable, users as oiasUsersTable } from '@oias/db';
import * as authSchema from '@oias/db/schema';

const db = createDb(env.DATABASE_URL);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'org';
}

async function uniqueSlug(base: string): Promise<string> {
  const { eq } = await import('drizzle-orm');
  let candidate = base;
  let n = 1;
  while (true) {
    const existing = await db.select().from(orgsTable).where(eq(orgsTable.slug, candidate)).limit(1);
    if (existing.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  secret: env.JWT_SECRET,
  baseURL: env.API_URL,
  basePath: '/api/v1/auth',
  trustedOrigins: [env.APP_URL],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      organisationName: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          // newUser includes the additional `organisationName` we declared above.
          const orgName =
            (newUser as { organisationName?: string | null }).organisationName?.trim() ||
            `${newUser.name}'s workspace`;

          const slug = await uniqueSlug(slugify(orgName));

          const [org] = await db
            .insert(orgsTable)
            .values({ name: orgName, slug })
            .returning();

          if (!org) throw new Error('Failed to create organisation for new user');

          await db.insert(oiasUsersTable).values({
            orgId: org.id,
            email: newUser.email,
            fullName: newUser.name,
            role: 'admin',
          });
        },
      },
    },
  },
  plugins: [admin(), organization()],
});

export type Auth = typeof auth;
