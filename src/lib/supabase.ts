import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://gjobscgqzbtcpkbclyqz.supabase.co'
const DEFAULT_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqb2JzY2dxemJ0Y3BrYmNseXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMDE5NjIsImV4cCI6MjEwMDc3Nzk2Mn0.x1kobDzi8IjCphEcVHNrKrN7oV6Slvnu-4XQaM7Q5MY'

const url = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL).trim()
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY).trim()

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    /**
     * Evita deadlock do navigator.locks (AbortError / "Failed to fetch")
     * quando writes (ex.: notas) competem com refresh de sessão / realtime.
     * Ver: supabase-js#2013, #2111
     */
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})

export const BOARD_ID = 'board-1'
