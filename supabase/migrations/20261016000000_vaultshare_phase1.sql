-- =============================================================================
-- VAULTSHARE — PHASE 1 SUPABASE POSTGRESQL PRODUCTION MIGRATION
-- Migration Version: 20261016000000_vaultshare_phase1
-- Tables: profiles, files, upload_sessions, file_ratings, download_history,
--         favorites, collections, collection_items, file_reports, notifications,
--         storage_usage, admin_audit_logs
-- Includes: Triggers, Constraints, Indexes, and Row Level Security (RLS) Policies
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users or standalone UUIDs)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique,
  avatar_url text,
  bio text default '',
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  storage_quota_bytes bigint not null default 5368709120, -- 5 GB default quota
  is_suspended boolean not null default false,
  is_email_verified boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_role on public.profiles(role);

-- -----------------------------------------------------------------------------
-- 2. FILES TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  category text not null check (category in (
    'video', 'audio', 'image', 'document', 'archive', 'software', 'ebook', 'design', 'other'
  )),
  tags text[] not null default '{}',
  original_filename text not null,
  object_key text not null unique, -- Random server-generated S3 / R2 key
  mime_type text not null,
  verified_file_type text not null,
  file_extension text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  upload_status text not null default 'ready' check (upload_status in ('pending', 'uploading', 'ready', 'failed', 'quarantined')),
  moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'flagged', 'rejected', 'quarantined')),
  
  -- Media specific metadata
  media_duration_seconds numeric(10, 2),
  media_resolution text, -- e.g. '8K', '4K', '1080p', '720p', '480p'
  media_codec text,
  media_bitrate text,
  sha256_checksum text,
  thumbnail_url text,
  preview_url text,
  share_token text unique,

  -- Derived counter columns
  views_count integer not null default 0,
  downloads_count integer not null default 0,
  rating_average numeric(3, 2) not null default 0.00 check (rating_average >= 0 and rating_average <= 10.0),
  rating_count integer not null default 0 check (rating_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_files_owner_id on public.files(owner_id);
create index if not exists idx_files_category on public.files(category);
create index if not exists idx_files_visibility on public.files(visibility);
create index if not exists idx_files_upload_status on public.files(upload_status);
create index if not exists idx_files_moderation_status on public.files(moderation_status);
create index if not exists idx_files_resolution on public.files(media_resolution);
create index if not exists idx_files_created_at on public.files(created_at desc);
create index if not exists idx_files_rating_average on public.files(rating_average desc);
create index if not exists idx_files_downloads_count on public.files(downloads_count desc);
create index if not exists idx_files_tags on public.files using gin(tags);

-- -----------------------------------------------------------------------------
-- 3. UPLOAD SESSIONS (For Multipart / Resumable Transfers)
-- -----------------------------------------------------------------------------
create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  s3_upload_id text not null,
  object_key text not null,
  filename text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  mime_type text not null,
  part_size_bytes bigint not null default 10485760, -- 10 MB part size default
  total_parts integer not null,
  completed_parts jsonb not null default '[]'::jsonb, -- Array of { PartNumber, ETag }
  status text not null default 'active' check (status in ('active', 'completed', 'aborted', 'expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_upload_sessions_user_id on public.upload_sessions(user_id);
create index if not exists idx_upload_sessions_status on public.upload_sessions(status);
create index if not exists idx_upload_sessions_s3_upload_id on public.upload_sessions(s3_upload_id);

-- -----------------------------------------------------------------------------
-- 4. FILE RATINGS (10-Star Ratings, Unique Per User Per File)
-- -----------------------------------------------------------------------------
create table if not exists public.file_ratings (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score smallint not null check (score >= 1 and score <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_file_ratings_user_file unique (file_id, user_id)
);

create index if not exists idx_file_ratings_file_id on public.file_ratings(file_id);
create index if not exists idx_file_ratings_user_id on public.file_ratings(user_id);

-- -----------------------------------------------------------------------------
-- 5. DOWNLOAD HISTORY
-- -----------------------------------------------------------------------------
create table if not exists public.download_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  download_status text not null default 'completed' check (download_status in ('initiated', 'completed', 'failed')),
  ip_address text,
  user_agent text,
  downloaded_at timestamptz not null default now()
);

create index if not exists idx_download_history_user_id on public.download_history(user_id);
create index if not exists idx_download_history_file_id on public.download_history(file_id);
create index if not exists idx_download_history_downloaded_at on public.download_history(downloaded_at desc);

-- -----------------------------------------------------------------------------
-- 6. FAVORITES
-- -----------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_favorites_user_file unique (user_id, file_id)
);

create index if not exists idx_favorites_user_id on public.favorites(user_id);
create index if not exists idx_favorites_file_id on public.favorites(file_id);

-- -----------------------------------------------------------------------------
-- 7. COLLECTIONS & COLLECTION ITEMS
-- -----------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  is_public boolean not null default true,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_user_id on public.collections(user_id);
create index if not exists idx_collections_is_public on public.collections(is_public);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete cascade,
  display_order integer not null default 0,
  added_at timestamptz not null default now(),
  constraint uq_collection_file unique (collection_id, file_id)
);

create index if not exists idx_collection_items_collection_id on public.collection_items(collection_id);
create index if not exists idx_collection_items_file_id on public.collection_items(file_id);

-- -----------------------------------------------------------------------------
-- 8. FILE REPORTS (Moderation System)
-- -----------------------------------------------------------------------------
create table if not exists public.file_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_file_id uuid not null references public.files(id) on delete cascade,
  reason text not null check (reason in ('copyright', 'malware', 'spam', 'inappropriate', 'other')),
  notes text default '',
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_file_reports_status on public.file_reports(status);
create index if not exists idx_file_reports_target_file_id on public.file_reports(target_file_id);
create index if not exists idx_file_reports_reporter_id on public.file_reports(reporter_id);

-- -----------------------------------------------------------------------------
-- 9. NOTIFICATIONS
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  link_url text,
  notification_type text not null default 'info' check (notification_type in ('info', 'success', 'warning', 'error', 'system')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);

-- -----------------------------------------------------------------------------
-- 10. STORAGE USAGE (Aggregated Per-User Storage Tracking)
-- -----------------------------------------------------------------------------
create table if not exists public.storage_usage (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_bytes_used bigint not null default 0 check (total_bytes_used >= 0),
  total_files_count integer not null default 0 check (total_files_count >= 0),
  storage_limit_bytes bigint not null default 5368709120, -- 5 GB
  last_calculated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 11. ADMIN AUDIT LOGS
-- -----------------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null, -- e.g. 'delete_file', 'suspend_user', 'update_role', 'resolve_report'
  target_entity_type text not null, -- 'file', 'user', 'setting', 'report'
  target_entity_id text not null,
  details jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_admin_id on public.admin_audit_logs(admin_id);
create index if not exists idx_admin_audit_logs_action on public.admin_audit_logs(action);
create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- AUTOMATED TRIGGERS & FUNCTIONS
-- -----------------------------------------------------------------------------

-- Trigger function: Update Rating Average and Count on File
create or replace function public.fn_sync_file_ratings()
returns trigger as $$
declare
  target_file_id uuid;
  avg_score numeric(3, 2);
  cnt integer;
begin
  if (TG_OP = 'DELETE') then
    target_file_id := OLD.file_id;
  else
    target_file_id := NEW.file_id;
  end if;

  select coalesce(round(avg(score), 2), 0.00), count(*)
  into avg_score, cnt
  from public.file_ratings
  where file_id = target_file_id;

  update public.files
  set rating_average = avg_score,
      rating_count = cnt,
      updated_at = now()
  where id = target_file_id;

  return null;
end;
$$ language plpgsql security definer;

create or replace trigger tr_sync_file_ratings
after insert or update or delete on public.file_ratings
for each row execute function public.fn_sync_file_ratings();

-- Trigger function: Sync Storage Usage on File Add/Delete
create or replace function public.fn_sync_storage_usage()
returns trigger as $$
declare
  target_user_id uuid;
  bytes_used bigint;
  cnt integer;
begin
  if (TG_OP = 'DELETE') then
    target_user_id := OLD.owner_id;
  else
    target_user_id := NEW.owner_id;
  end if;

  select coalesce(sum(file_size_bytes), 0), count(*)
  into bytes_used, cnt
  from public.files
  where owner_id = target_user_id;

  insert into public.storage_usage (user_id, total_bytes_used, total_files_count, last_calculated_at)
  values (target_user_id, bytes_used, cnt, now())
  on conflict (user_id) do update set
    total_bytes_used = bytes_used,
    total_files_count = cnt,
    last_calculated_at = now();

  return null;
end;
$$ language plpgsql security definer;

create or replace trigger tr_sync_storage_usage
after insert or update of file_size_bytes or delete on public.files
for each row execute function public.fn_sync_storage_usage();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.files enable row level security;
alter table public.upload_sessions enable row level security;
alter table public.file_ratings enable row level security;
alter table public.download_history enable row level security;
alter table public.favorites enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.file_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.storage_usage enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Profiles: Public can read basic profile info; owner can update profile; admins have full access
create policy "Public can view non-suspended profiles"
  on public.profiles for select
  using (not is_suspended);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id or auth.uid() = id);

-- Files: Public can read public & unlisted files that are ready & approved; owner can read/write their own
create policy "Anyone can view public and unlisted files"
  on public.files for select
  using (
    (visibility in ('public', 'unlisted') and upload_status = 'ready' and moderation_status = 'approved')
    or (auth.uid() = owner_id)
  );

create policy "Authenticated users can insert own files"
  on public.files for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own files"
  on public.files for update
  using (auth.uid() = owner_id);

create policy "Owners can delete own files"
  on public.files for delete
  using (auth.uid() = owner_id);

-- Upload Sessions: Only owner can view, update or abort sessions
create policy "Users can manage own upload sessions"
  on public.upload_sessions for all
  using (auth.uid() = user_id);

-- Ratings: Anyone can view ratings; authenticated users can insert/update their own
create policy "Anyone can view ratings"
  on public.file_ratings for select
  using (true);

create policy "Users can insert or update own rating"
  on public.file_ratings for all
  using (auth.uid() = user_id);

-- Download History: Users can view own download history
create policy "Users can view own download history"
  on public.download_history for select
  using (auth.uid() = user_id);

create policy "Users can insert download history"
  on public.download_history for insert
  with check (auth.uid() = user_id);

-- Favorites: Users can manage own favorites
create policy "Users can manage own favorites"
  on public.favorites for all
  using (auth.uid() = user_id);

-- Collections: Public collections visible to all; private visible to owner only
create policy "Anyone can view public collections"
  on public.collections for select
  using (is_public or auth.uid() = user_id);

create policy "Users can manage own collections"
  on public.collections for all
  using (auth.uid() = user_id);

create policy "Users can view collection items"
  on public.collection_items for select
  using (true);

create policy "Users can manage items in own collections"
  on public.collection_items for all
  using (
    exists (
      select 1 from public.collections
      where id = collection_items.collection_id
      and user_id = auth.uid()
    )
  );

-- Reports: Authenticated users can create reports; only admins/moderators can view all
create policy "Users can submit reports"
  on public.file_reports for insert
  with check (auth.uid() = reporter_id);

-- Notifications: Users can view and manage their own notifications
create policy "Users can view own notifications"
  on public.notifications for all
  using (auth.uid() = user_id);

-- Storage Usage: Users can view their own storage usage
create policy "Users can view own storage usage"
  on public.storage_usage for select
  using (auth.uid() = user_id);
