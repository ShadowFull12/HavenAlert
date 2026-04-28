import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  error: null,

  initialize: async () => {
    // Safety timeout — loading can NEVER stay stuck beyond 8 seconds
    const timeout = setTimeout(() => {
      if (get().loading) {
        console.warn('HavenAlert: auth init timed out, forcing loading=false');
        set({ loading: false });
      }
    }, 8000);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await get()._fetchProfile(session.user.id);
        set({ user: session.user, session, profile, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false, error: err.message });
    } finally {
      clearTimeout(timeout);
    }

    // Handle token refresh and sign-out from other tabs only
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, session: null, profile: null });
      } else if (event === 'TOKEN_REFRESHED' && session) {
        set({ user: session.user, session });
      }
    });
  },

  _fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.error('Profile fetch error:', error);
      return data || null;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  },

  signUp: async (email, password, fullName, role = 'guest') => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Signup failed — no user returned.');

      // Give DB trigger time to create profile row
      await new Promise(r => setTimeout(r, 700));
      await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, role });

      const profile = await get()._fetchProfile(data.user.id);
      set({ user: data.user, session: data.session, profile, loading: false });
      return { data, error: null };
    } catch (err) {
      set({ loading: false, error: err.message });
      return { data: null, error: err };
    }
  },

  signIn: async (email, password) => {
    set({ error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const profile = await get()._fetchProfile(data.user.id);
      set({ user: data.user, session: data.session, profile });
      return { data, error: null };
    } catch (err) {
      set({ error: err.message });
      return { data: null, error: err };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null });
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await get()._fetchProfile(user.id);
    if (profile) set({ profile });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
