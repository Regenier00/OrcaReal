import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './pages/Auth';
import { ensureUserProfile } from './services/profile';
import { Profile } from './pages/profile';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trata a sessão atual do usuário
    const handleSession = async (currentUser: User | null) => {
      try {
        if (currentUser) {
          await ensureUserProfile(
            currentUser.id,
            currentUser.user_metadata?.name || '',
            currentUser.email
          );
        }

        setUser(currentUser);
      } catch (error) {
        console.error('Erro ao sincronizar perfil:', error);
        setUser(currentUser);
      } finally {
        setLoading(false);
      }
    };

    // Verifica se já existe uma sessão ativa
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await handleSession(session?.user ?? null);
    };

    loadSession();

    // Escuta alterações de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session?.user ?? null);
    });

    // Remove o listener quando o componente for desmontado
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Enquanto verifica a sessão
  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          marginTop: '50px',
        }}
      >
        Carregando...
      </div>
    );
  }

  // Usuário não autenticado
  if (!user) {
    return <Auth />;
  }

  // Usuário autenticado
  return <Profile user={user} />;
}

export default App;