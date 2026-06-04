import { createAuthClient } from 'better-auth/react';
import { adminClient, organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001',
  basePath: '/api/v1/auth',
  plugins: [adminClient(), organizationClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
