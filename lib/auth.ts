import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/lib/db';

// secret og baseURL læses automatisk fra BETTER_AUTH_SECRET og BETTER_AUTH_URL i .env
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Skal stå sidst: lader Server Actions sætte session-cookien
  plugins: [nextCookies()],
});
