# OrcaReal

Plataforma de análise orçamentária (Orçado × Realizado).

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

A home, as funcionalidades e a demonstração em `/demo` abrem sem Supabase. **Login, cadastro e recuperação de senha precisam das chaves do projeto.**

## Autenticação (Supabase)

O erro *Configuração de autenticação ausente* aparece quando o front não encontra a URL e a chave pública do Supabase.

1. No [dashboard](https://supabase.com/dashboard) abra o projeto → **Connect** (Vite) ou **Settings → API Keys**.
2. Cole no `.env` (na raiz do repositório):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Projetos antigos ainda usam a chave JWT `anon`. Neste caso:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

As duas formas são aceitas. Não use a `service_role` / secret no front.

3. Reinicie o `npm run dev` (o Vite só lê o `.env` na subida).
4. Aplique as migrations: `npx supabase db push`.

Em preview/CI, defina as mesmas variáveis no ambiente de build (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY`). Também funcionam os aliases `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
