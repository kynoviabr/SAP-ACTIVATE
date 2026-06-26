import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'http://127.0.0.1:54321'
const supabaseKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'dev-placeholder-anon-key'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase env vars. Using local development placeholders.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
})

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('*, tenant:tenants(*)')
    .eq('id', user.id)
    .single()
  return data
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export function subscribeToTable(
  table: string,
  projectId: string,
  callback: (payload: unknown) => void
) {
  return supabase
    .channel(`${table}:${projectId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table,
      filter: `project_id=eq.${projectId}`,
    }, callback)
    .subscribe()
}

const BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'project-attachments'

export async function uploadFile(path: string, file: File) {
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { path: data.path, publicUrl: urlData.publicUrl }
}
