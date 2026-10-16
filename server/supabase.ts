import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project-id') &&
    !SUPABASE_ANON_KEY.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
  );
};

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

export function getSupabaseIntegrationStatus() {
  const configured = isSupabaseConfigured();
  return {
    isConfigured: configured,
    databaseEngine: configured ? 'Supabase PostgreSQL (Active)' : 'PostgreSQL Schema Ready (Local Database Driver)',
    url: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 15)}...` : 'Not configured',
    hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_SERVICE_ROLE_KEY.includes('...')),
    migrationFile: 'supabase/migrations/20261016000000_vaultshare_phase1.sql',
    tablesSupported: [
      'profiles',
      'files',
      'upload_sessions',
      'file_ratings',
      'download_history',
      'favorites',
      'collections',
      'collection_items',
      'file_reports',
      'notifications',
      'storage_usage',
      'admin_audit_logs'
    ],
    features: [
      'Row Level Security (RLS) on all 12 tables',
      '1 to 10 Star Rating Uniqueness Constraints & Automatic Recalculation Trigger',
      'Per-User Storage Quota Synchronization Trigger',
      'Multipart / Resumable Upload Sessions Tracking',
      'Expiring Private Link Authorization'
    ],
    setupInstructions: {
      step1: 'Create a new project at https://supabase.com/dashboard',
      step2: 'Navigate to SQL Editor and run the SQL migration located at `supabase/migrations/20261016000000_vaultshare_phase1.sql`.',
      step3: 'Go to Project Settings > API and copy Project URL, anon key, and service_role key.',
      step4: 'Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to your environment secrets.',
      envVariables: [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY'
      ]
    }
  };
}
