import { supabase } from '../lib/supabase';

export async function ensureUserProfile(
  userId: string,
  name: string,
  email?: string
) {
  console.log('Tentando buscar perfil para o ID:', userId);

  // 1. Verifica se o perfil já existe
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar perfil:', error);
    return null;
  }

  // 2. Se já existe, retorna
  if (profile) {
    console.log('Perfil encontrado no banco:', profile);
    return profile;
  }

  console.log('Perfil não encontrado. Criando novo registro...');

  // 3. Cria o perfil
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert([
      {
        id: userId,
        name: name,
        email: email || '',
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error(
      'ERRO DETALHADO AO CRIAR PERFIL:',
      insertError
    );
    return null;
  }

  console.log(
    'Perfil criado com sucesso:',
    newProfile
  );

  return newProfile;
}

// Atualiza o perfil do usuário
export async function updateUserProfile(
  userId: string,
  name: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error(
      'Erro ao atualizar perfil:',
      error
    );
    return null;
  }

  console.log(
    'Perfil atualizado com sucesso:',
    data
  );

  return data;
}