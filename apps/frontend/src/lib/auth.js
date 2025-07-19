import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';
import { passkeyClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3000', // Backend URL
  plugins: [
    usernameClient(),
    passkeyClient(),
    adminClient(),
    organizationClient(),
  ], // Add plugins as needed
});

export const { signIn, signUp, signOut, useSession } = authClient;

// Export admin client functions for user management
export const admin = authClient.admin;
export const passkey = authClient.passkey;
export const organization = authClient.organization;

// Export specific passkey functions for easier access
export const { addPasskey } = authClient.passkey || {};

// Export correct passkey sign-in function
export const signInPasskey = authClient.signIn.passkey;
