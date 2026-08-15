import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

export async function ensureUserProfile(
  userId: string,
  name: string,
  email?: string | null
): Promise<Profile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar perfil:', error)
    return null
  }

  if (profile) return profile as Profile

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert([
      {
        id: userId,
        name: name || 'Usuário',
        email: email || '',
      },
    ])
    .select()
    .single()

  if (insertError) {
    console.error('Erro ao criar perfil:', insertError)
    return null
  }

  return newProfile as Profile
}

export async function updateUserProfile(
  userId: string,
  name: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar perfil:', error)
    return null
  }

  return data as Profile
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao carregar perfil:', error)
    return null
  }

  return data as Profile | null
}
