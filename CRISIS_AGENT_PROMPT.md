# AGENT BUILD PROMPT — RAPID CRISIS RESPONSE PLATFORM
## "HavenAlert" — Hospitality Crisis Management & Venue Operations System

---

## YOUR ROLE

You are a senior full-stack engineer building a production-ready, real-time web application called **HavenAlert**. You will build this from scratch, file by file, with zero placeholder data, zero mock APIs, and zero hardcoded fake content. Every feature must work end-to-end with a live backend. When you need an API key or external credential from the user, stop and ask for it clearly before proceeding. Do not guess or skip it.

---

## BEFORE YOU WRITE A SINGLE LINE OF CODE — DO THIS FIRST

1. Ask the user for their **Supabase project URL** and **Supabase anon public key**. Explain that they need to go to supabase.com, create a free project, and find these in Project Settings → API.
2. Ask the user for their **Gemini API key** (they will provide it — store it only in `.env` as `VITE_GEMINI_API_KEY`, never hardcode it anywhere).
3. Ask the user for their **Twilio Account SID**, **Auth Token**, and **Twilio phone number** — OR confirm they want to skip SMS for now and use only in-app notifications (Twilio has a free trial tier).
4. Once you have these, create a `.env` file at the root with all keys and never expose them client-side except the Supabase anon key and Gemini key (which are safe for client use).
5. Run the full Supabase SQL schema (provided below) and confirm all tables, RLS policies, and realtime subscriptions are active before building the frontend.

---

## TECH STACK — DO NOT DEVIATE

- **Frontend:** React 18 + Vite, TailwindCSS (with `@tailwindcss/forms` plugin), React Router v6, Zustand for global state
- **Backend:** Supabase (Postgres database, Realtime subscriptions, Row Level Security, Edge Functions, Auth, Storage) — this IS the backend, no separate server needed
- **AI:** Google Gemini API (`gemini-2.0-flash-lite` model) via `@google/generative-ai` npm package — used for triage chat, incident briefing, report generation, translation, sentiment analysis
- **Notifications:** Supabase Realtime for in-app, Supabase Edge Functions + fetch to Twilio REST API for SMS (only if user provides Twilio keys)
- **PWA:** `vite-plugin-pwa` with Workbox for offline SOS capability
- **Icons:** `lucide-react` only
- **Date/time:** `date-fns`
- **Maps:** `react-leaflet` + OpenStreetMap (completely free, no API key needed)
- **Charts (admin analytics):** `recharts`
- **QR codes:** `qrcode.react` for generating venue/staff codes
- **Toast notifications:** `react-hot-toast`

**No other libraries unless absolutely necessary. Ask the user before adding anything.**

---

## SUPABASE SETUP — RUN THIS SQL IN THE SUPABASE SQL EDITOR EXACTLY

```sql
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

-- Staff members: venue owner full, staff read own venue
create policy "staff_members_owner" on staff_members for all using (
  exists (select 1 from venues v where v.id = staff_members.venue_id and v.owner_id = auth.uid())
);
create policy "staff_members_read" on staff_members for select using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = staff_members.venue_id)
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
create policy "invites_read_code" on staff_invites for select using (true);

-- Staff groups
create policy "groups_owner" on staff_groups for all using (
  exists (select 1 from venues v where v.id = staff_groups.venue_id and v.owner_id = auth.uid())
);
create policy "groups_staff_read" on staff_groups for select using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = staff_groups.venue_id)
);

-- Floors
create policy "floors_access" on floors for all using (
  exists (select 1 from staff_members sm where sm.profile_id = auth.uid() and sm.venue_id = floors.venue_id)
);

-- TRIGGER: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
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
```

---

## PROJECT FILE STRUCTURE — BUILD IN THIS ORDER

```
havenalert/
├── .env                          ← VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY
├── index.html
├── vite.config.js                ← include vite-plugin-pwa
├── tailwind.config.js            ← include forms plugin, custom colors
├── src/
│   ├── main.jsx
│   ├── App.jsx                   ← router setup
│   ├── lib/
│   │   ├── supabase.js           ← supabase client init
│   │   ├── gemini.js             ← gemini client + helper functions
│   │   └── audit.js              ← audit log helper (calls log_audit RPC)
│   ├── store/
│   │   ├── authStore.js          ← user, profile, session
│   │   └── venueStore.js         ← active venue, staff permissions
│   ├── hooks/
│   │   ├── useRealtimeIncidents.js
│   │   ├── useRealtimeQueue.js
│   │   ├── useRealtimeMessages.js
│   │   └── usePermissions.js     ← checks staff_members permissions array
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── auth/
│   │   │   ├── GuestRegister.jsx
│   │   │   ├── GuestLogin.jsx
│   │   │   ├── VenueRegister.jsx
│   │   │   ├── VenueLogin.jsx
│   │   │   └── StaffLogin.jsx
│   │   ├── guest/
│   │   │   ├── GuestDashboard.jsx     ← enter venue code, see status
│   │   │   ├── GuestSOS.jsx           ← emergency trigger
│   │   │   ├── GuestIncidentChat.jsx  ← live chat with staff
│   │   │   ├── GuestComplaints.jsx    ← submit + track complaints
│   │   │   └── GuestProfile.jsx      ← medical profile, preferences
│   │   ├── venue/
│   │   │   ├── VenueDashboard.jsx     ← overview + stats
│   │   │   ├── IncidentBoard.jsx      ← live incidents list
│   │   │   ├── IncidentDetail.jsx     ← full incident + audit trail + chat
│   │   │   ├── GuestQueue.jsx         ← pending guests, assign to rooms
│   │   │   ├── RoomManager.jsx        ← floors + rooms + occupancy
│   │   │   ├── StaffManager.jsx       ← invite, groups, permissions
│   │   │   ├── ComplaintsBoard.jsx    ← all guest complaints
│   │   │   ├── ComplaintDetail.jsx    ← complaint thread + resolution
│   │   │   ├── Broadcasts.jsx         ← send announcements
│   │   │   ├── Analytics.jsx          ← charts, risk scores
│   │   │   ├── AuditLog.jsx           ← compliance trail
│   │   │   └── VenueSettings.jsx      ← venue profile, venue code display
│   │   └── NotFound.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── GuestLayout.jsx        ← mobile bottom nav
│   │   │   ├── VenueLayout.jsx        ← sidebar (desktop) + bottom nav (mobile)
│   │   │   └── ProtectedRoute.jsx
│   │   ├── incidents/
│   │   │   ├── IncidentCard.jsx
│   │   │   ├── IncidentChat.jsx       ← realtime messages
│   │   │   ├── AuditTrail.jsx         ← timeline of all events
│   │   │   └── SOSButton.jsx          ← the big red button
│   │   ├── venue/
│   │   │   ├── VenueCodeCard.jsx      ← shows code + QR, copy button
│   │   │   ├── StaffInviteModal.jsx
│   │   │   ├── RoomCard.jsx
│   │   │   └── QueueCard.jsx
│   │   ├── ai/
│   │   │   └── AITriage.jsx           ← gemini streaming chat
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Badge.jsx
│   │       ├── Modal.jsx
│   │       ├── Spinner.jsx
│   │       └── EmptyState.jsx
```

---

## PAGE-BY-PAGE REQUIREMENTS

### Landing Page (`Landing.jsx`)
- Full-screen hero with product name, tagline, and a short value proposition
- Two clear CTA paths side by side (or stacked on mobile): "I'm a Guest" and "I manage a venue"
- Each CTA leads to its respective register/login flow
- A third smaller link: "Staff login" at the bottom
- Minimal, confident design — dark theme or high-contrast light. No carousels, no animations that block content.

### Guest Onboarding (`GuestRegister.jsx` + `GuestLogin.jsx`)
- Register: full name, email, password — one clean form, submit creates Supabase auth user and profile row
- Login: email + password
- After login → `GuestDashboard`

### Guest Dashboard (`GuestDashboard.jsx`)
- If guest has no venue: show a prominent "Enter your venue code" input field. When they submit a valid code, insert into `guest_queue` with status `pending`. Show a "You're in the queue — the venue will assign you a room shortly" message with a live status indicator (use Supabase Realtime subscription on their queue row)
- If guest has a room assigned (profile.room_id is set): show their room number, venue name, and the full action grid: SOS button, Report a complaint, My active incidents, Safety info
- Mobile bottom navigation: Home, SOS, Complaints, Profile

### SOS Page (`GuestSOS.jsx`)
- Giant centered emergency button — fills most of the screen, red, labeled "SEND SOS"
- Below it: incident type selector chips (Medical, Fire, Security, Other)
- Silent mode toggle (labeled "Silent — no alerts on my device")
- On press: insert row into `incidents` table immediately (optimistic UI — don't wait for confirmation), then open `GuestIncidentChat` with that incident_id
- After insert: call Gemini API to generate an AI briefing for staff (store in incident.ai_briefing) — do this in the background, don't block the user
- Works offline: if Supabase call fails, store in localStorage and retry every 5 seconds

### Venue Onboarding (`VenueRegister.jsx`)
- Fields: venue name, type (hotel / resort / hostel / event space / other), owner full name, email, password, address, city, country, phone
- On submit: create Supabase auth user, create profile with role='owner', create venue row — the venue_code is auto-generated by the database
- After registration → `VenueDashboard`

### Venue Dashboard (`VenueDashboard.jsx`)
- Top summary cards: Active incidents, Guests in rooms, Pending queue, Open complaints
- Below: two columns — Recent incidents list (last 5, with live updates), Recent complaints list (last 5)
- A live "Risk pulse" badge (calculated on frontend: if active critical incidents > 0 → Critical, high > 0 → Elevated, else → Normal)
- All numbers update in real time via Supabase Realtime subscriptions

### Venue Settings + Code (`VenueSettings.jsx`)
- Venue profile form (editable name, address, contact, logo upload to Supabase Storage)
- **Venue Code section**: large display of the venue_code, a "Copy" button, and a QR code generated by `qrcode.react` — guests can scan it to pre-fill the code input in their app
- Option to regenerate the code (with a confirmation warning that existing guests will need the new code)

### Staff Manager (`StaffManager.jsx`)
- Tab 1 — Staff list: table of all staff_members for this venue, their name, role, group, active status. Owner can change role, remove staff, toggle active
- Tab 2 — Groups: create/edit staff groups, assign permissions checkboxes from the full `staff_permission` enum list
- Tab 3 — Invite codes: generate a staff invite code (stored in `staff_invites`), assign it a role and optionally a group. Display the code and a copy button. Show expiry. List all past codes and whether they were used.
- **Permissions system**: a staff member's effective permissions = their group's permissions UNION their custom_permissions. The `usePermissions` hook reads this and every protected UI element checks it before rendering.

### Staff Login (`StaffLogin.jsx`)
- Email + password (Supabase auth)
- After login, check if profile has a linked staff_members row. If not, show "Enter your staff invite code" field. On submit, find the invite in `staff_invites` where code matches AND used_by is null AND expires_at > now(). If valid, create the staff_members row, mark invite as used. Then proceed to venue dashboard with staff-level access.

### Guest Queue (`GuestQueue.jsx`)
- Live list of all guests in `guest_queue` with status=pending for this venue
- Each card shows: guest name, requested time, a "Assign Room" button
- Clicking "Assign Room" opens a modal with a dropdown of available rooms (status='available'). On confirm: update room.current_guest_id, update room.status to 'occupied', update profile.venue_id and profile.room_id, update queue row to status='processed'. All in a single transaction using a Supabase RPC function.
- The guest's app updates in real time — their dashboard switches from queue-waiting to room-assigned state

### Room Manager (`RoomManager.jsx`)
- Floor tabs across the top. Each floor shows a grid of room cards.
- Room card shows: room number, type, status (color coded), current guest name if occupied
- Add room / edit room modal
- Click on an occupied room → see guest profile summary, option to check them out (clears current_guest_id, resets status to 'available', removes room_id from profile)
- Add floor button (creates floor row, no map required for hackathon — just a name and number)

### Incident Board (`IncidentBoard.jsx`)
- Live list of all incidents for the venue, sorted by severity then created_at
- Filter tabs: All, Open, In Progress, Resolved
- Each card: severity badge (color coded), type icon, title, reporter name, time elapsed, assigned staff name
- Click → `IncidentDetail`
- Realtime: new incidents appear at top with a subtle animation

### Incident Detail (`IncidentDetail.jsx`)
- Left panel (or top on mobile): incident info, severity/status/type selectors (staff can update), assign-to dropdown (staff list), AI briefing section (auto-loaded, with a "Regenerate" button that calls Gemini)
- Right panel (or bottom on mobile): live chat (Supabase Realtime on incident_messages), input to send message
- Bottom section: **Audit Trail** — chronological timeline of all incident_events rows for this incident, showing who did what and when. This is the compliance record. Every status change, assignment, message, and AI action auto-inserts a row into incident_events.
- "Generate Full Report" button: calls Gemini with the full incident timeline and generates a formatted incident report, stored in incident.ai_report, downloadable as text.

### Complaints Board + Detail
- Same structure as Incident Board/Detail but for complaints
- Simpler severity — priority field (low/normal/high/urgent)
- Staff can assign, message, and resolve with resolution notes
- Guest can see status updates in their app in real time

### Audit Log (`AuditLog.jsx`)
- Paginated table of all `audit_log` rows for the venue
- Columns: timestamp, actor name, role, action, resource type, resource ID
- Expandable row: shows before/after JSON state
- Filter by date range, actor, action type
- Export to CSV button (build this with vanilla JS — no library needed)
- Only visible to owner and managers (enforced by `usePermissions` hook)

### Analytics (`Analytics.jsx`)
- Incidents by type — recharts BarChart
- Incidents over time — recharts LineChart (last 30 days)
- Average resolution time — computed from incident created_at vs resolved_at
- Staff response rate (how many incidents each staff member has handled)
- All data pulled from Supabase queries, no fake numbers

---

## AI (GEMINI) INTEGRATION — HOW TO USE IT

Use `@google/generative-ai` package. Initialize with `VITE_GEMINI_API_KEY`. Model: `gemini-2.0-flash-lite`.

Build these functions in `src/lib/gemini.js`:

```javascript
// 1. Triage classification — called on SOS trigger
// Input: guest's description of emergency
// Output: { type, severity, briefing, recommendedActions }
export async function triageIncident(description, guestLanguage)

// 2. Incident briefing — called when staff opens an incident
// Input: incident object + guest medical profile
// Output: 3-sentence briefing for staff
export async function generateBriefing(incident, medicalProfile)

// 3. Translate message — called on every incident message if language != 'en'
// Input: message text, source language, target language
// Output: translated string
export async function translateMessage(text, from, to)

// 4. Full incident report — called on demand
// Input: incident + all incident_events + all incident_messages
// Output: formatted markdown report
export async function generateIncidentReport(incident, events, messages)

// 5. Sentiment analysis — called on guest SOS description
// Input: text
// Output: { distressLevel: 'low'|'medium'|'high'|'critical', urgencySignals: string[] }
export async function analyzeDistress(text)
```

All calls must use try/catch and show toast errors if the API fails. Never block the SOS flow on an AI call — AI runs in background after the incident is already created.

---

## DESIGN PHILOSOPHY — READ THIS BEFORE WRITING ANY CSS

### Core aesthetic
Clean, calm authority. This is a crisis tool — it must feel trustworthy, fast, and clear. No playfulness, no decoration for its own sake. Every pixel earns its place.

### Color system
- Primary: `#0F172A` (slate-900) — deep dark, used for text and key UI
- Accent: `#EF4444` (red-500) — reserved ONLY for SOS, critical alerts, and danger states
- Warning: `#F59E0B` (amber-500) — high severity, warnings
- Success: `#10B981` (emerald-500) — resolved, safe, confirmed
- Info: `#3B82F6` (blue-500) — assigned, in progress, informational
- Background: `#F8FAFC` (slate-50) for guest app, `#0F172A` (slate-900) sidebar for venue dashboard
- Surface: white cards on light bg, `#1E293B` cards on dark bg

### Typography
- Font: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`) — no Google Fonts needed, loads instantly
- Headings: font-weight 600, tight tracking
- Body: 15px, line-height 1.6
- Captions/labels: 12px, uppercase, letter-spacing 0.05em, muted color

### Mobile-first rules — ENFORCE THESE WITHOUT EXCEPTION
- Every page must be designed for 375px width first. Then enhanced for tablet (768px) and desktop (1024px+).
- No horizontal overflow anywhere — test every page at 375px
- Touch targets minimum 44x44px — buttons, nav items, interactive elements
- Bottom navigation for mobile (guest app always, venue dashboard on mobile)
- Sidebar appears only at md: breakpoint and above for venue dashboard
- All modals must be bottom sheets on mobile (slide up from bottom, full-width, scrollable) and centered dialogs on desktop
- Font sizes never below 14px on mobile
- Padding: minimum 16px horizontal on mobile, 24px on tablet+
- Tables: on mobile, transform to card list view (hide columns, show as labeled rows)
- Form inputs: full width on mobile always

### Animation
- Only use `transition` properties: opacity, transform, background-color — nothing that triggers layout reflow
- Duration: 150ms for micro interactions, 250ms for panel transitions, 300ms for modals
- No animation on the SOS button — it must feel instant and serious
- New incident cards slide in from top with a 200ms translateY + opacity transition
- Use `will-change: transform` on animated elements

### Loading states
- Every async operation shows a skeleton or spinner — no blank screens ever
- Skeletons: gray pulse animation on placeholder shapes (Tailwind `animate-pulse`)
- The SOS button shows a brief "Sending..." state then immediately goes to the chat — don't make the user wait

### Error states
- Every error shows a toast (react-hot-toast) and logs to console
- Forms show inline field-level errors in red below each input
- If Supabase is unreachable, show a persistent banner at the top: "Connection lost — retrying..."
- Empty states: every list that could be empty has an illustration-free empty state with a clear message and a primary action button

---

## REALTIME IMPLEMENTATION GUIDE

For every page that needs live data, follow this pattern exactly:

```javascript
useEffect(() => {
  // 1. Initial fetch
  fetchData();

  // 2. Subscribe to realtime changes
  const channel = supabase
    .channel('unique-channel-name')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'incidents',
      filter: `venue_id=eq.${venueId}`
    }, (payload) => {
      // handle INSERT, UPDATE, DELETE
      if (payload.eventType === 'INSERT') {
        setIncidents(prev => [payload.new, ...prev]);
        toast('New incident reported', { icon: '🚨' });
      }
      if (payload.eventType === 'UPDATE') {
        setIncidents(prev => prev.map(i => i.id === payload.new.id ? payload.new : i));
      }
    })
    .subscribe();

  // 3. Cleanup
  return () => supabase.removeChannel(channel);
}, [venueId]);
```

Apply this to: incidents, incident_messages, guest_queue, complaints, complaint_messages, rooms, broadcasts.

---

## PERMISSIONS ENFORCEMENT — HOW TO BUILD IT

In `usePermissions.js`:
```javascript
export function usePermissions() {
  const { staffMember, staffGroup } = useVenueStore();
  
  const effectivePermissions = useMemo(() => {
    if (!staffMember) return [];
    const groupPerms = staffGroup?.permissions || [];
    const customPerms = staffMember.custom_permissions || [];
    return [...new Set([...groupPerms, ...customPerms])];
  }, [staffMember, staffGroup]);

  const can = (permission) => {
    if (staffMember?.role === 'owner') return true; // owner bypasses all
    if (staffMember?.role === 'manager') return true; // manager gets all for now
    return effectivePermissions.includes(permission);
  };

  return { can, effectivePermissions };
}
```

Usage in components:
```jsx
const { can } = usePermissions();
// ...
{can('manage_staff') && <Button onClick={openInviteModal}>Add staff</Button>}
```

Every venue dashboard nav item, every action button, every tab must run through `can()` before rendering.

---

## WHAT TO ASK THE USER BEFORE STARTING — EXACT QUESTIONS

Say this to the user at the very beginning:

> "Before I start building, I need a few things from you:
> 
> 1. **Supabase project URL** — go to supabase.com → New project → wait for it to provision → Settings → API → copy 'Project URL'
> 2. **Supabase anon public key** — same page, copy 'anon public' key
> 3. **Gemini API key** — you mentioned you have this, please share it now and I'll put it in the .env file securely
> 4. **Do you want SMS notifications via Twilio?** It's free with a trial account. If yes, I'll need your Twilio Account SID, Auth Token, and Twilio phone number. If no, we'll use in-app notifications only for now and you can add Twilio later.
> 
> Once you give me these, I'll run the full database schema in Supabase, then build every page from scratch. Nothing will be fake or mocked."

---

## ADDITIONAL RULES — FOLLOW WITHOUT EXCEPTION

1. **No lorem ipsum, no fake names, no hardcoded data anywhere.** Every piece of data comes from Supabase.
2. **Every form has validation** — required fields, email format, password minimum 8 characters, shown inline before submit.
3. **Every destructive action has a confirmation** — deleting staff, removing a guest from a room, regenerating a venue code — all require a confirm dialog.
4. **The SOS flow must complete in under 2 taps** — tap SOS button, tap incident type, incident is created. That's it.
5. **Audit every state-changing action** — every INSERT/UPDATE/DELETE on incidents, rooms, staff_members, and complaints must also insert a row into audit_log via the `log_audit` RPC function.
6. **Mobile navigation**: Guest app always uses bottom tabs. Venue dashboard: sidebar on desktop (md+), bottom tabs on mobile.
7. **Build page by page, confirm each one works before moving to the next.** Do not scaffold all files at once and leave them empty.
8. **Environment variables**: all Supabase and Gemini keys go in `.env` as `VITE_` prefixed variables. Never commit `.env`. Add `.env` to `.gitignore` immediately.
9. **Gemini API calls must never block the UI.** Run them with `Promise.resolve().then(() => callGemini(...))` after the primary Supabase write completes.
10. **If you get stuck on anything** — a Supabase RLS error, a realtime subscription not firing, a Gemini quota error — tell the user exactly what the problem is and what they need to do to fix it. Do not silently work around it with fake data.

---

## BUILD ORDER

Build in this exact sequence, testing each step:

1. Project setup (Vite + React + Tailwind + all dependencies)
2. `.env` file + `supabase.js` client + `gemini.js` client
3. Run SQL schema in Supabase, confirm all tables exist
4. Auth store + routing skeleton
5. Landing page
6. Guest register + login + dashboard (enter venue code + queue state)
7. Venue register + login + settings page (with venue code display + QR)
8. Guest queue page (live, realtime)
9. Room manager (floors + rooms + assign guest from queue)
10. Staff manager (groups + permissions + invite codes)
11. Staff login + invite code flow
12. SOS page + incident creation + Gemini triage (background)
13. Incident board (realtime)
14. Incident detail (chat + audit trail + AI briefing + report)
15. Complaints (guest submit + venue board + detail thread)
16. Broadcasts page
17. Analytics page
18. Audit log page
19. PWA config + offline SOS fallback
20. Final mobile responsiveness pass — test every page at 375px

---

*End of agent prompt. This document is the complete specification. Follow it exactly.*
