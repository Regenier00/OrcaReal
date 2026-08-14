import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ensureUserProfile } from '../services/profile';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // 1. Cria o usuário no Supabase Auth
        const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name: name,
    },
  },
});

        if (error) {
          setMessage(error.message);
          return;
        }

        // 2. Verifica se o usuário foi criado
        if (!data.user) {
          setMessage('Não foi possível criar o usuário.');
          return;
        }

        // 3. Verifica o usuário e a sessão retornados pelo Supabase
        console.log('Usuário retornado pelo cadastro:', data.user);
        console.log('Sessão retornada pelo cadastro:', data.session);

        // 4. Cria o perfil na tabela profiles
        const profile = await ensureUserProfile(
          data.user.id,
          name,
          email
        );

        if (!profile) {
          setMessage(
            'Usuário criado, mas não foi possível criar o perfil.'
          );
          return;
        }

        setMessage('Cadastro realizado com sucesso!');

        // Limpa os campos
        setName('');
        setEmail('');
        setPassword('');
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage('Login efetuado com sucesso!');
      }
    } catch (error) {
      console.error('Erro na autenticação:', error);
      setMessage('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '50px auto',
        padding: '20px',
      }}
    >
      <h2>{isSignUp ? 'Criar Conta' : 'Entrar'}</h2>

      <form onSubmit={handleAuth}>
        {isSignUp && (
          <div style={{ marginBottom: '10px' }}>
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
        )}

        <div style={{ marginBottom: '10px' }}>
          <label>E-mail:</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>Senha:</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
            ? 'Carregando...'
            : isSignUp
              ? 'Cadastrar'
              : 'Entrar'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '10px' }}>
          {message}
        </p>
      )}

      <p style={{ marginTop: '15px' }}>
        {isSignUp
          ? 'Já tem uma conta?'
          : 'Ainda não tem conta?'}{' '}

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'blue',
            cursor: 'pointer',
          }}
        >
          {isSignUp ? 'Faça Login' : 'Cadastre-se'}
        </button>
      </p>
    </div>
  );
}