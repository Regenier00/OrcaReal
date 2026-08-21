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

O erro *Configuração de autenticação ausente* (ou *No API key found in request*) aparece quando o front não encontra a URL e a chave pública do Supabase, ou quando a chave não é enviada no header `apikey`. Isso também bloqueia **importação de ERP/extrato**, storage e RPCs — não só o login.

Se o `.env` local já está correto e o erro continua:

1. Confirme que reiniciou o `npm run dev` depois de salvar o `.env`.
2. No navegador, DevTools → Network → a chamada para `*.supabase.co` deve ter header `apikey` (ou `?apikey=`).
3. Em preview/produção, as variáveis precisam existir **no ambiente de build** (Vite embute `VITE_*` no bundle); `.env` só na sua máquina não entra no deploy.
4. URL e chave precisam ser do **mesmo** projeto (publishable `sb_publishable_…` ou anon JWT `eyJ…`).

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
