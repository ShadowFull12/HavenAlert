import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const useVenueStore = create((set, get) => ({
  venue: null,
  staffMember: null,
  staffGroup: null,
  venues: [],
  loading: false,

  // Load venue by its ID — also loads the staff member record for current user
  loadVenue: async (venueId) => {
    set({ loading: true });
    try {
      const { data: venue, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      set({ venue, loading: false });

      // Also load the current user's staff_member record for this venue
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await get().loadStaffMember(session.user.id, venueId);
      }
      return venue;
    } catch (err) {
      console.error('Load venue error:', err);
      set({ loading: false });
      return null;
    }
  },

  loadStaffMember: async (userId, venueId) => {
    try {
      const { data: staffMember } = await supabase
        .from('staff_members')
        .select('*')
        .eq('profile_id', userId)
        .eq('venue_id', venueId)
        .single();

      if (staffMember?.group_id) {
        const { data: staffGroup } = await supabase
          .from('staff_groups')
          .select('*')
          .eq('id', staffMember.group_id)
          .single();
        set({ staffMember, staffGroup });
      } else {
        set({ staffMember: staffMember || null, staffGroup: null });
      }

      return staffMember;
    } catch (err) {
      console.error('Load staff member error:', err);
      return null;
    }
  },

  // Load venue where current user is the owner (owner_id = userId)
  loadOwnerVenue: async (userId) => {
    try {
      const { data: venue } = await supabase
        .from('venues')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (venue) {
        set({ venue });
        // Load staff member record
        const { data: staffMember } = await supabase
          .from('staff_members')
          .select('*')
          .eq('profile_id', userId)
          .eq('venue_id', venue.id)
          .single();

        set({ staffMember: staffMember || { role: 'owner', venue_id: venue.id, profile_id: userId, custom_permissions: [] } });
        return venue;
      }
      return null;
    } catch (err) {
      console.error('Load owner venue error:', err);
      return null;
    }
  },

  // Load venue via staff_members join (for staff/manager linked by staff_members table)
  loadStaffVenue: async (userId) => {
    try {
      const { data: staffMember } = await supabase
        .from('staff_members')
        .select('*, venues(*)')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .single();

      if (staffMember) {
        set({
          venue: staffMember.venues,
          staffMember: { ...staffMember, venues: undefined },
        });

        if (staffMember.group_id) {
          const { data: staffGroup } = await supabase
            .from('staff_groups')
            .select('*')
            .eq('id', staffMember.group_id)
            .single();
          set({ staffGroup });
        }
        return staffMember;
      }
      return null;
    } catch (err) {
      console.error('Load staff venue error:', err);
      return null;
    }
  },

  // Unified loader — tries strategies based on the user's current profile role
  loadVenueForUser: async (profile) => {
    if (!profile) return null;
    const { role, id: userId, venue_id } = profile;

    // If the user's profile role is 'guest' with no venue_id, they have no venue
    if (role === 'guest' && !venue_id) return null;

    // Strategy 1: Owner — check venues.owner_id
    if (role === 'owner') {
      const v = await get().loadOwnerVenue(userId);
      if (v) return v;
    }

    // Strategy 2: Staff/Manager — check staff_members join
    if (role === 'staff' || role === 'manager') {
      const sm = await get().loadStaffVenue(userId);
      if (sm) return get().venue;
    }

    // Strategy 3: Fallback — load venue from profile.venue_id
    if (venue_id) {
      const v = await get().loadVenue(venue_id);
      if (v) return v;
    }

    return null;
  },

  createVenue: async (venueData, userId) => {
    try {
      const { data: venue, error } = await supabase
        .from('venues')
        .insert({ ...venueData, owner_id: userId })
        .select()
        .single();

      if (error) throw error;

      // Create owner as staff member with full permissions
      const { data: sm, error: smError } = await supabase
        .from('staff_members')
        .insert({
          venue_id: venue.id,
          profile_id: userId,
          role: 'owner',
          custom_permissions: [
            'view_incidents', 'manage_incidents', 'delete_incidents',
            'view_guests', 'manage_guests',
            'view_rooms', 'manage_rooms',
            'view_complaints', 'manage_complaints', 'delete_complaints',
            'view_staff', 'manage_staff', 'view_analytics', 'manage_venue'
          ],
        })
        .select()
        .single();

      if (smError) console.error('Staff member insert error (will retry via RPC):', smError);

      // Predefined role groups are auto-created by the database trigger (venue_create_predefined_roles)

      // Update profile
      await supabase
        .from('profiles')
        .update({ role: 'owner', venue_id: venue.id })
        .eq('id', userId);

      set({ venue, staffMember: sm || { role: 'owner', venue_id: venue.id, profile_id: userId, custom_permissions: [] } });
      return { venue, error: null };
    } catch (err) {
      console.error('Create venue error:', err);
      return { venue: null, error: err };
    }
  },

  reset: () => set({ venue: null, staffMember: null, staffGroup: null, venues: [] }),
}));

export default useVenueStore;
