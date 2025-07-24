import { AuthProvider } from './AuthContext';
import { PermissionsProvider } from './PermissionsContext/index.js';

/**
 * Combined provider that wraps both AuthProvider and PermissionsProvider
 * This maintains the same API as the original AuthProvider while providing
 * optimized performance through context splitting.
 */
export const CombinedAuthProvider = ({ children }) => {
  return (
    <AuthProvider>
      <PermissionsProvider>{children}</PermissionsProvider>
    </AuthProvider>
  );
};
