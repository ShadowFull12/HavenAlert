-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ENUMS
create type user_role as enum ('guest', 'staff', 'manager', 'owner');
create type incident_status as enum ('open', 'assigned', 'in_progress', 'escalated', 'resolved', 'closed');
create type incident_type as enum ('medical', 'fire', 'security', 'maintenance', 'noise', 'theft', 'other');
create type incident_severity as enum ('low', 'medium', 'high', 'critical');
create type staff_permission as enum (
  'view_incidents', 'manage_incidents', 'view_guests', 'manage_guests',
  'view_rooms', 'manage_rooms', 'view_complaints', 'manage_complaints',
  'view_staff', 'manage_staff', 'view_analytics', 'manage_venue'
);

-- VENUES
create table venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'hotel',
  address text,
  city text,
  country text,
  phone text,
  email text,
  logo_url text,
  venue_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  owner_id uuid references auth.users(id) on delete cascade,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROFILES (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  role user_role default 'guest',
  venue_id uuid references venues(id) on delete set null,
  room_id uuid,
  medical_profile jsonb default '{}',
  language_preference text default 'en',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- STAFF GROUPS
create table staff_groups (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  name text not null,
  description text,
  permissions staff_permission[] default '{}',
  created_at timestamptz default now()
);

-- STAFF MEMBERS (links profiles to venues with roles and permissions)
create table staff_members (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  role user_role default 'staff',
  group_id uuid references staff_groups(id) on delete set null,
  custom_permissions staff_permission[] default '{}',
  is_active boolean default true,
  joined_at timestamptz default now(),
  unique(venue_id, profile_id)
);

-- STAFF INVITE CODES
create table staff_invites (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  code text unique not null default upper(substring(md5(random()::text), 1, 10)),
  role user_role default 'staff',
  group_id uuid references staff_groups(id) on delete set null,
  created_by uuid references profiles(id),
  used_by uuid references profiles(id),
  used_at timestamptz,
  expires_at timestamptz default now() + interval '7 days',
  created_at timestamptz default now()
);

-- FLOORS
create table floors (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  name text not null,
  floor_number integer not null,
  map_svg text,
  created_at timestamptz default now()
);

-- ROOMS
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  floor_id uuid references floors(id) on delete set null,
  room_number text not null,
  room_type text default 'standard',
  capacity integer default 2,
  status text default 'available',
  current_guest_id uuid references profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  unique(venue_id, room_number)
);

-- GUEST QUEUE (guests who have entered venue code but not yet been placed)
create table guest_queue (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  guest_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending',
  notes text,
  requested_at timestamptz default now(),
  processed_at timestamptz,
  processed_by uuid references profiles(id),
  unique(venue_id, guest_id)
);

-- INCIDENTS
create table incidents (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  reported_by uuid references profiles(id),
  assigned_to uuid references profiles(id),
  room_id uuid references rooms(id),
  title text not null,
  description text,
  type incident_type not null default 'other',
  severity incident_severity not null default 'medium',
  status incident_status not null default 'open',
  location_text text,
  ai_briefing text,
  ai_report text,
  is_silent boolean default false,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- INCIDENT EVENTS (immutable audit log)
create table incident_events (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id) on delete cascade not null,
  actor_id uuid references profiles(id),
  event_type text not null,
  description text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- INCIDENT MESSAGES (live chat per incident)
create table incident_messages (
  id uuid primary key default uuid_generate_v4(),
  incident_id uuid references incidents(id) on delete cascade not null,
  sender_id uuid references profiles(id),
  message text not null,
  translated_message text,
  original_language text,
  is_staff boolean default false,
  created_at timestamptz default now()
);

-- COMPLAINTS
create table complaints (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  guest_id uuid references profiles(id),
  assigned_to uuid references profiles(id),
  room_id uuid references rooms(id),
  title text not null,
  description text not null,
  category text default 'general',
  status text default 'open',
  priority text default 'normal',
  resolution_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COMPLAINT MESSAGES
create table complaint_messages (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid references complaints(id) on delete cascade not null,
  sender_id uuid references profiles(id),
  message text not null,
  is_staff boolean default false,
  created_at timestamptz default now()
);

-- BROADCASTS
create table broadcasts (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete cascade not null,
  sent_by uuid references profiles(id),
  title text not null,
  message text not null,
  target_audience text default 'all',
  created_at timestamptz default now()
);

-- AUDIT LOG (compliance — never delete from this table)
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id),
  actor_id uuid references profiles(id),
  actor_role user_role,
  action text not null,
  resource_type text,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- Update profiles.room_id FK after rooms table exists
alter table profiles add constraint profiles_room_id_fkey
  foreign key (room_id) references rooms(id) on delete set null;

-- REALTIME — enable for these tables
alter publication supabase_realtime add table incidents;
alter publication supabase_realtime add table incident_messages;
alter publication supabase_realtime add table incident_events;
alter publication supabase_realtime add table guest_queue;
alter publication supabase_realtime add table complaints;
alter publication supabase_realtime add table complaint_messages;
alter publication supabase_realtime add table broadcasts;
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table staff_members;

-- TRIGGERS

-- Auto-create owner staff record when venue is created
CREATE OR REPLACE FUNCTION on_venue_created() RETURNS trigger AS $$
BEGIN
  INSERT INTO staff_members (venue_id, profile_id, role, custom_permissions, is_active)
  VALUES (
    NEW.id, NEW.owner_id, 'owner',
    ARRAY['view_incidents','manage_incidents','view_guests','manage_guests','view_rooms','manage_rooms','view_complaints','manage_complaints','view_staff','manage_staff','view_analytics','manage_venue']::staff_permission[],
    true
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER venue_created_trigger AFTER INSERT ON venues FOR EACH ROW EXECUTE FUNCTION on_venue_created();

-- Reset user profile when staff record is deleted (leave / removal)
CREATE OR REPLACE FUNCTION on_staff_member_deleted() RETURNS trigger AS $$
BEGIN
  UPDATE profiles SET venue_id = NULL, role = 'guest' WHERE id = OLD.profile_id AND venue_id = OLD.venue_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER staff_member_deleted_trigger AFTER DELETE ON staff_members FOR EACH ROW EXECUTE FUNCTION on_staff_member_deleted();

-- ROW LEVEL SECURITY
alter table venues enable row level security;
alter table profiles enable row level security;
alter table staff_members enable row level security;
alter table staff_groups enable row level security;
alter table staff_invites enable row level security;
alter table floors enable row level security;
alter table rooms enable row level security;
alter table guest_queue enable row level security;
alter table incidents enable row level security;
alter table incident_events enable row level security;
alter table incident_messages enable row level security;
alter table complaints enable row level security;
alter table complaint_messages enable row level security;
alter table broadcasts enable row level security;
alter table audit_log enable row level security;

-- RLS POLICIES (permissive for hackathon — tighten in production)
-- Profiles: users can read/update their own
create policy "profiles_own" on profiles for all using (auth.uid() = id);
create policy "profiles_venue_read" on profiles for select using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = profiles.venue_id)
);

-- Venues: owners full access, staff read
create policy "venues_owner" on venues for all using (owner_id = auth.uid());
create policy "venues_staff_read" on venues for select using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = venues.id)
);
create policy "venues_guest_read" on venues for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.venue_id = venues.id)
);

-- Helper functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_venue_staff(p_venue_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_members 
    WHERE venue_id = p_venue_id AND profile_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_venue_manager(p_venue_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff_members 
    WHERE venue_id = p_venue_id AND profile_id = auth.uid() AND role IN ('manager', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff members: venue owner full, staff read own venue
create policy "staff_members_owner" on staff_members for all using (
  exists (select 1 from venues v where v.id = staff_members.venue_id and v.owner_id = auth.uid())
);
create policy "staff_members_manager_manage" on staff_members for all using (
  is_venue_manager(venue_id)
);
create policy "staff_members_self_insert" on staff_members for insert with check (
  profile_id = auth.uid()
);
create policy "staff_members_read" on staff_members for select using (
  is_venue_staff(venue_id)
);



-- Incidents: venue staff access
create policy "incidents_venue_access" on incidents for all using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = incidents.venue_id)
  or reported_by = auth.uid()
);

-- Incident messages: same
create policy "incident_messages_access" on incident_messages for all using (
  exists (select 1 from incidents i where i.id = incident_messages.incident_id and (
    exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = i.venue_id)
    or i.reported_by = auth.uid()
  ))
);

-- Guest queue: venue staff + the guest themselves
create policy "queue_access" on guest_queue for all using (
  guest_id = auth.uid() or
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = guest_queue.venue_id)
);

-- Rooms
create policy "rooms_venue_access" on rooms for all using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = rooms.venue_id)
  or exists (select 1 from profiles p where p.id = auth.uid() and p.room_id = rooms.id)
);

-- Complaints
create policy "complaints_access" on complaints for all using (
  guest_id = auth.uid() or
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = complaints.venue_id)
);

-- Complaint messages
create policy "complaint_messages_access" on complaint_messages for all using (
  exists (select 1 from complaints c where c.id = complaint_messages.complaint_id and (
    c.guest_id = auth.uid() or
    exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = c.venue_id)
  ))
);

-- Audit log: owners and managers only
create policy "audit_log_access" on audit_log for select using (
  exists (select 1 from venues v where v.id = audit_log.venue_id and v.owner_id = auth.uid())
  or exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = audit_log.venue_id and sm.role = 'manager')
);
create policy "audit_log_insert" on audit_log for insert with check (true);

-- Broadcasts
create policy "broadcasts_read" on broadcasts for select using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = broadcasts.venue_id)
  or exists (select 1 from profiles p where p.id = auth.uid() and p.venue_id = broadcasts.venue_id)
);
create policy "broadcasts_write" on broadcasts for insert with check (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = broadcasts.venue_id)
);

-- Staff invites
create policy "invites_owner" on staff_invites for all using (
  exists (select 1 from venues v where v.id = staff_invites.venue_id and v.owner_id = auth.uid())
);
create policy "invites_manager" on staff_invites for all using (
  is_venue_manager(venue_id)
);
create policy "invites_read_code" on staff_invites for select using (true);
create policy "invites_redeem" on staff_invites for update using (used_by IS NULL) with check (used_by = auth.uid());

-- Staff groups
create policy "groups_owner" on staff_groups for all using (
  exists (select 1 from venues v where v.id = staff_groups.venue_id and v.owner_id = auth.uid())
);
create policy "groups_manager" on staff_groups for all using (
  is_venue_manager(venue_id)
);
create policy "groups_staff_read" on staff_groups for select using (
  is_venue_staff(venue_id)
);



-- Floors
create policy "floors_access" on floors for all using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = floors.venue_id)
);

-- TRIGGER: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'guest');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- TRIGGER: audit log helper function
create or replace function log_audit(
  p_venue_id uuid, p_actor_id uuid, p_actor_role user_role,
  p_action text, p_resource_type text, p_resource_id uuid,
  p_before jsonb default null, p_after jsonb default null
) returns void as $$
begin
  insert into audit_log (venue_id, actor_id, actor_role, action, resource_type, resource_id, before_state, after_state)
  values (p_venue_id, p_actor_id, p_actor_role, p_action, p_resource_type, p_resource_id, p_before, p_after);
end;
$$ language plpgsql security definer;

-- TRIGGER: auto-create predefined role groups when a venue is created
create or replace function create_predefined_role_groups()
returns trigger as $$
begin
  insert into staff_groups (venue_id, name, description, color, permissions) values
    (NEW.id, 'Manager', 'Full management access across all venue operations', '#8b5cf6',
     ARRAY['view_incidents','manage_incidents','delete_incidents','view_complaints','manage_complaints','delete_complaints','view_guests','manage_guests','view_rooms','manage_rooms','view_staff','manage_staff','view_analytics','manage_venue']::staff_permission[]),
    (NEW.id, 'Front Desk', 'Guest check-in/check-out, queue management, and complaint handling', '#3b82f6',
     ARRAY['view_incidents','view_complaints','manage_complaints','view_guests','manage_guests','view_rooms']::staff_permission[]),
    (NEW.id, 'Security', 'Incident response, monitoring, and guest safety', '#ef4444',
     ARRAY['view_incidents','manage_incidents','view_complaints','view_guests','view_rooms']::staff_permission[]),
    (NEW.id, 'Housekeeping', 'Room management, maintenance, and cleanliness', '#22c55e',
     ARRAY['view_rooms','manage_rooms','view_complaints']::staff_permission[]);
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists venue_create_predefined_roles on venues;
create trigger venue_create_predefined_roles
  after insert on venues
  for each row execute function create_predefined_role_groups();
