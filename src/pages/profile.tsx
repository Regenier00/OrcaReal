import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { updateUserProfile } from '../services/profile';

interface ProfileProps {
  user: User;
}

export function Profile({ user }: ProfileProps) {
  const [name, setName] = useState(
    user.user_metadata?.name || ''
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setMessage('O nome não pode ficar vazio.');
      return;
    }

    setLoading(true);
    setMessage('');

    const profile = await updateUserProfile(
      user.id,
      name.trim()
    );

    if (!profile) {
      setMessage('Não foi possível atualizar o perfil.');
      setLoading(false);
      return;
    }

    setMessage('Perfil atualizado com sucesso!');
    setLoading(false);
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '50px auto',
        padding: '20px',
      }}
    >
      <h2>Meu Perfil</h2>

      <form onSubmit={handleUpdate}>
        <div style={{ marginBottom: '15px' }}>
          <label>Nome:</label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>E-mail:</label>

          <input
            type="email"
            value={user.email || ''}
            disabled
            style={{
              width: '100%',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
          }}
        >
          {loading
            ? 'Salvando...'
            : 'Salvar alterações'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '15px' }}>
          {message}
        </p>
      )}
    </div>
  );
}