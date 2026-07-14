import { useAuth } from "./auth-context";

// Alias for useAuth
export function useSession() {
  return useAuth();
}
