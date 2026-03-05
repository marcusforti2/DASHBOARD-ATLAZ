import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "closer" | "sdr";

interface AuthState {
  user: User | null;
  role: AppRole | null;
  roles: AppRole[];
  profile: { full_name: string; avatar_url: string | null; team_member_id: string | null } | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, role: null, roles: [], profile: null, loading: true });

  const fetchUserData = useCallback(async (user: User) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("full_name, avatar_url, team_member_id").eq("id", user.id).single(),
    ]);
    const allRoles = (roles?.map(r => r.role as AppRole)) || [];
    // Primary role: admin takes priority
    const primaryRole = allRoles.includes("admin") ? "admin" : allRoles[0] || null;
    setState({ user, role: primaryRole, roles: allRoles, profile: profile || null, loading: false });
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setState({ user: null, role: null, roles: [], profile: null, loading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setState({ user: null, role: null, roles: [], profile: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    ...state,
    signOut,
    isAdmin: state.roles.includes("admin"),
    isCloser: state.roles.includes("closer"),
    isSdr: state.roles.includes("sdr"),
    isAdminCloser: state.roles.includes("admin") && state.roles.includes("closer"),
    isAdminSdr: state.roles.includes("admin") && state.roles.includes("sdr"),
  };
}
