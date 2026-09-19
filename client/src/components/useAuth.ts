import { useEffect, useState } from "react";
import { auth, type UserProfile } from "@/lib/api";

/** Subscribes a component to the shared auth store in lib/api. */
export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(auth.user);
  useEffect(() => auth.subscribe(setUser) as unknown as () => void, []);

  return {
    user,
    isSignedIn: user !== null,
    isAdmin: user?.roles.includes("Admin") ?? false,
    signOut: () => auth.clear(),
  };
}
