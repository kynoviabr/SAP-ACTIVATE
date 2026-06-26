# Conectar Supabase e GitHub

## Supabase

1. Crie um projeto no Supabase.
2. No dashboard, copie:
   - Project URL
   - anon/public API key
3. Crie `.env.local` a partir de `.env.local.example`:

```bash
cp .env.local.example .env.local
```

4. Preencha:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```

5. Rode a migration SQL em `supabase/migrations/001_initial_schema.sql` no SQL Editor do Supabase ou via CLI.

Observação: mudanças recentes do Supabase fazem com que novas tabelas em `public` possam não ficar expostas automaticamente na Data API. A migration já inclui grants explícitos para `authenticated`.

## GitHub

Se você já tiver um repositório criado no GitHub:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git add .
git commit -m "Initial SAP Activate portal"
git push -u origin main
```

Se usar SSH:

```bash
git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

Nesta máquina, `gh` não está disponível no terminal agora. Então a conexão automática via GitHub CLI depende de instalar/autenticar o `gh` ou de você me passar a URL do remote para eu configurar com `git remote add origin`.

