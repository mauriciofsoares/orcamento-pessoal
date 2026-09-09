# Orçamento Pessoal

Portal pessoal para acompanhar receitas, despesas, lançamentos recorrentes e projeções financeiras.

## Stack

- Next.js App Router, React e TypeScript
- Supabase Auth com login por e-mail e Google OAuth
- Prisma 7 e PostgreSQL
- Groq para importação assistida por IA
- Vitest para testes unitários de ownership
- PWA com manifest e service worker para assets públicos

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha os valores do ambiente local.

As variáveis `NEXT_PUBLIC_*` são valores públicos de runtime. Chaves do Groq, senha do app, URLs de banco e chaves administrativas Supabase devem permanecer server-side e nunca devem ser commitadas.

3. Suba o PostgreSQL local:

```bash
npm run db:up
```

O banco fica disponível somente em `127.0.0.1:5433`.

4. Gere/aplique migrations somente quando a etapa de banco estiver autorizada:

```bash
npm run db:generate
npm run db:migrate
```

5. Inicie o desenvolvimento:

```bash
npm run dev
```

A aplicação local fica em `http://localhost:3000`.

## Autenticação

O portal usa Supabase Auth. O callback local é `/auth/callback`; configure os Redirect URLs no projeto Supabase e no provedor Google conforme o ambiente. O Basic Auth permanece temporariamente como camada adicional para as rotas protegidas.

## Testes e validação

```bash
npm run test
npm run lint
npm run build
```

Os testes unitários mockam autenticação, Prisma e providers externos. Eles não devem ser usados como substitutos dos testes de integração com um PostgreSQL isolado.

O script `scripts/backfill-local.ts` é administrativo e restrito ao banco local. Execute-o somente com autorização explícita e nunca contra produção.

## Segurança

Não commit `.env`, tokens, senhas, connection strings, chaves administrativas ou qualquer outro secret. Use `.env.example` apenas como referência de nomes e valores fictícios.
