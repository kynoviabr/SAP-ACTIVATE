# ESPECIFICAÇÃO TÉCNICA COMPLETA
## Portal de Gestão de Projetos SAP Activate — White Label Multi-Tenant
### Stack: React + Vite + Supabase + Tailwind CSS
### Gerado em: 24/06/2026 | Para uso no OpenAI Codex

---

## ÍNDICE

1. Visão Geral do Produto
2. Stack Tecnológica
3. Arquitetura Multi-Tenant
4. Schema do Banco de Dados (Supabase)
5. Estrutura de Pastas do Projeto
6. Módulos e Páginas
7. Templates por Fase (27 templates)
8. Módulos Transversais
9. Sistema de IA (multi-backend)
10. Sistema de Autenticação e Perfis
11. Dashboard Automático e KPIs
12. White Label — Customização por Tenant
13. Prompts para o Codex (build por etapas)

---

## 1. VISÃO GERAL DO PRODUTO

**Nome sugerido:** [NOME_DO_PRODUTO] (white label — configurável por tenant)
**Tipo:** SPA (Single Page Application) sem recarregamento entre telas
**Metodologia:** SAP Activate (5 fases: Prepare → Explore → Realize → Deploy → Run)
**Público-alvo:** Consultorias SAP e seus clientes
**Modelo de negócio:** White label multi-tenant — cada consultoria tem instância própria com logo, cores e domínio

**Funcionalidades core:**
- Gestão de projetos SAP Activate com 27 templates estruturados
- Dashboard automático com EVM (SPI/CPI), Gantt e RAG status
- Assistente de IA multi-backend (Ollama, LM Studio, OpenAI, Anthropic)
- Multi-tenant com isolamento completo por tenant_id
- Customização de marca por tenant (logo, cores, nome)
- Multi-idioma (PT-BR, EN, ES, ZH)
- Realtime via Supabase WebSocket
- Backup/restore em JSON
- Exportação de relatórios (PDF, PPTX)

---

## 2. STACK TECNOLÓGICA

```
Frontend:     React 18 + Vite + TypeScript
Estilo:       Tailwind CSS + shadcn/ui
Estado:       Zustand (global) + React Query (server state)
Roteamento:   React Router v6
Banco:        Supabase (PostgreSQL + Auth + Realtime + Storage)
Deploy:       Vercel (frontend) + Supabase Cloud (backend)
IA:           Integração multi-backend (Ollama / LM Studio / OpenAI / Anthropic)
Gráficos:     Recharts (dashboard) + custom SVG (Gantt)
Exportação:   jspdf + xlsx + pptxgenjs
Internac.:    i18next + react-i18next
```

### Dependências principais (package.json)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.22.0",
    "@supabase/supabase-js": "^2.39.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.20.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "recharts": "^2.10.0",
    "i18next": "^23.8.0",
    "react-i18next": "^14.0.0",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.0",
    "xlsx": "^0.18.5",
    "pptxgenjs": "^3.12.0",
    "date-fns": "^3.3.0",
    "lucide-react": "^0.344.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

---

## 3. ARQUITETURA MULTI-TENANT

### Estratégia: Row-Level Security (RLS) no Supabase

Cada tenant (consultoria) tem um `tenant_id` UUID. Todas as tabelas possuem a coluna `tenant_id`. O RLS garante isolamento: usuários só veem dados do próprio tenant.

### Fluxo de criação de tenant

```
1. Super Admin cria tenant via painel admin
2. Tenant recebe: tenant_id, slug, nome, logo_url, primary_color
3. Super Admin cria o primeiro ADM do tenant
4. ADM do tenant cria usuários e projetos
```

### Hierarquia de perfis

```
SUPER_ADMIN  →  Gerencia tenants, vê tudo
ADM          →  Gerencia usuários e projetos do tenant
USER         →  Acessa projetos liberados para ele
```

### JWT customizado

O JWT do Supabase é customizado via `auth.users` + tabela `user_profiles` para injetar `tenant_id` e `role` nos claims. Usar `auth.uid()` + policy RLS em todas as tabelas.

---

## 4. SCHEMA DO BANCO DE DADOS (Supabase / PostgreSQL)

### 4.1 Tenants

```sql
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,           -- ex: "cliente-atlas", "cliente-aurora"
  name            TEXT NOT NULL,                  -- ex: "Cliente Atlas Consultoria"
  logo_url        TEXT,
  favicon_url     TEXT,
  primary_color   TEXT DEFAULT '#3B5BDB',         -- hex
  secondary_color TEXT DEFAULT '#1C7ED6',
  app_name        TEXT DEFAULT 'Portal de Projetos SAP',
  app_subtitle    TEXT DEFAULT 'Melhores práticas de gestão sistêmica',
  custom_domain   TEXT,                           -- ex: "portal.cast.com.br"
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 User Profiles

```sql
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'USER'  -- USER | ADM | SUPER_ADMIN
               CHECK (role IN ('USER', 'ADM', 'SUPER_ADMIN')),
  avatar_url  TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id);
```

### 4.3 Projects

```sql
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  client                TEXT NOT NULL,
  consulting_firm       TEXT,
  project_manager       TEXT,
  sap_modules           TEXT[],                  -- ex: ['FI','CO','MM','SD']
  start_date            DATE,
  go_live_date          DATE,
  scope_description     TEXT,
  budget_total          NUMERIC(15,2),
  current_phase         INTEGER DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 5),
  language              TEXT DEFAULT 'pt-BR',
  status                TEXT DEFAULT 'active'    -- active | closed | deleted
                         CHECK (status IN ('active','closed','deleted')),
  rag_status            TEXT DEFAULT 'green'     -- green | yellow | red
                         CHECK (rag_status IN ('green','yellow','red')),
  contract_number       TEXT,
  sap_environment       TEXT,                    -- ex: 'DEV/QAS/PRD — S/4HANA 2023'
  status_meeting        TEXT,                    -- ex: 'Sextas, 14h — Teams'
  daily_meeting         TEXT,
  stakeholders          TEXT,
  communication_strategy TEXT,
  notes                 TEXT,
  team_locked           BOOLEAN DEFAULT FALSE,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON projects
  USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
```

### 4.4 Project Members (Equipe)

```sql
CREATE TABLE project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  module        TEXT NOT NULL,                   -- ex: 'FI', 'BASIS', 'SD'
  consultants   TEXT[],                          -- nomes dos consultores/key-users
  leader        TEXT,
  email         TEXT,                            -- email de acesso ao portal
  role          TEXT DEFAULT 'USER' CHECK (role IN ('USER','ADM')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Templates

```sql
CREATE TABLE templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase         INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 5),
  template_key  TEXT NOT NULL,                   -- ex: 'kickoff', 'scope_definition'
  template_name TEXT NOT NULL,
  status        TEXT DEFAULT 'pending'           -- pending | in_progress | completed
                 CHECK (status IN ('pending','in_progress','completed')),
  data          JSONB DEFAULT '{}',              -- conteúdo específico do template
  completed_by  UUID REFERENCES auth.users(id),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, phase, template_key)
);

-- Index para busca por projeto e fase
CREATE INDEX idx_templates_project_phase ON templates(project_id, phase);
```

### 4.6 Schedule (Cronograma Macro e Detalhado)

```sql
CREATE TABLE schedule_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('macro','detailed')),
  wbs             TEXT,                          -- ex: '1.2.3'
  task_name       TEXT NOT NULL,
  phase           INTEGER CHECK (phase BETWEEN 1 AND 5),
  sprint          TEXT,
  responsible     TEXT,
  start_date      DATE,
  end_date        DATE,
  planned_hours   NUMERIC(8,2),
  actual_hours    NUMERIC(8,2) DEFAULT 0,
  pct_complete    NUMERIC(5,2) DEFAULT 0 CHECK (pct_complete BETWEEN 0 AND 100),
  predecessor_id  UUID REFERENCES schedule_tasks(id),
  is_milestone    BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.7 Issues (Pendências)

```sql
CREATE TABLE issues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  issue_number  SERIAL,
  description   TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('decisao','informacao','tarefa','aprovacao','bloqueio')),
  priority      TEXT NOT NULL DEFAULT 'media'
                 CHECK (priority IN ('baixa','media','alta','critica')),
  responsible   TEXT,
  opened_by     TEXT,
  open_date     DATE DEFAULT CURRENT_DATE,
  due_date      DATE,
  status        TEXT DEFAULT 'aberta'
                 CHECK (status IN ('aberta','em_andamento','resolvida','cancelada')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.8 Risks (Riscos)

```sql
CREATE TABLE risks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES projects(id) ON DELETE CASCADE,
  risk_number         SERIAL,
  description         TEXT NOT NULL,
  category            TEXT,
  impact              INTEGER CHECK (impact BETWEEN 1 AND 4),
  probability         INTEGER CHECK (probability BETWEEN 1 AND 4),
  exposure            INTEGER GENERATED ALWAYS AS (impact * probability) STORED,
  responsible         TEXT,
  opened_by           TEXT,
  open_date           DATE DEFAULT CURRENT_DATE,
  due_date            DATE,
  status              TEXT DEFAULT 'aberto'
                       CHECK (status IN ('aberto','em_andamento','mitigado','fechado','cancelado')),
  mitigation_plan     TEXT,
  contingency_plan    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.9 BPD Items (SOW/BPD — Fase 2)

```sql
CREATE TABLE bpd_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id              UUID REFERENCES projects(id) ON DELETE CASCADE,
  process_code            TEXT,
  process_name            TEXT NOT NULL,
  modules                 TEXT[],
  key_users               TEXT[],
  functional_consultants  TEXT[],
  doc_status              TEXT DEFAULT 'em_ajustes'
                           CHECK (doc_status IN ('em_ajustes','em_analise','aprovado','cancelado')),
  doc_location            TEXT,
  objective               TEXT,
  process_overview        TEXT,
  triggers                TEXT,
  inputs                  TEXT,
  standard_flow           TEXT,
  business_definition     TEXT,
  solution_summary        TEXT,
  standard_configs        JSONB DEFAULT '[]',
  developments            JSONB DEFAULT '[]',
  deliverables            TEXT,
  special_scenarios       TEXT,
  open_orders             TEXT,
  interfaces              TEXT,
  data_load               TEXT,
  retrofit                TEXT,
  test_criteria           TEXT,
  out_of_scope            TEXT,
  deltas                  TEXT,
  custom_objects          TEXT,
  references              TEXT,
  sort_order              INTEGER DEFAULT 0,
  version                 INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.10 Execution Plan (Plano de Execução — Fase 3)

```sql
CREATE TABLE execution_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  sprint          TEXT,
  title           TEXT NOT NULL,
  module          TEXT,
  responsible     TEXT[],
  start_date      DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'pendente'
                   CHECK (status IN ('pendente','em_andamento','concluido','bloqueado')),
  sap_requests    TEXT[],
  activities      JSONB DEFAULT '[]',
  acceptance      TEXT,
  blockers        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.11 Test Cases (Plano de Testes)

```sql
CREATE TABLE test_cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  test_type       TEXT NOT NULL CHECK (test_type IN ('SIT','UAT')),
  cycle           TEXT,
  module          TEXT,
  scenario        TEXT NOT NULL,
  test_data       TEXT,
  expected_result TEXT,
  actual_result   TEXT,
  status          TEXT DEFAULT 'pendente'
                   CHECK (status IN ('pendente','aprovado','reprovado','bloqueado','retest')),
  tester          TEXT,
  execution_date  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.12 Bugs

```sql
CREATE TABLE bugs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  test_case_id    UUID REFERENCES test_cases(id),
  bug_number      SERIAL,
  title           TEXT NOT NULL,
  description     TEXT,
  test_type       TEXT CHECK (test_type IN ('SIT','UAT')),
  severity        TEXT CHECK (severity IN ('baixa','media','alta','critica')),
  module          TEXT,
  status          TEXT DEFAULT 'aberto'
                   CHECK (status IN ('aberto','em_andamento','resolvido','cancelado')),
  responsible     TEXT,
  reported_by     TEXT,
  reported_date   DATE DEFAULT CURRENT_DATE,
  resolved_date   DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.13 Quality Gates

```sql
CREATE TABLE quality_gates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  phase           INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 5),
  reviewer        TEXT,
  decision        TEXT CHECK (decision IN ('aprovada','rejeitada')),
  items           JSONB DEFAULT '[]',            -- [{template_key, status, observations}]
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, phase)
);
```

### 4.14 Costs

```sql
CREATE TABLE costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category    TEXT,
  amount      NUMERIC(15,2),
  currency    TEXT DEFAULT 'BRL',
  date        DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.15 Change Requests

```sql
CREATE TABLE change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  cr_number       SERIAL,
  title           TEXT NOT NULL,
  description     TEXT,
  impact          TEXT,
  requester       TEXT,
  status          TEXT DEFAULT 'aberta'
                   CHECK (status IN ('aberta','aprovada','rejeitada','cancelada')),
  decision_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.16 Billing (Faturamento)

```sql
CREATE TABLE billing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone       TEXT NOT NULL,
  amount          NUMERIC(15,2),
  currency        TEXT DEFAULT 'BRL',
  due_date        DATE,
  invoice_date    DATE,
  payment_date    DATE,
  status          TEXT DEFAULT 'pendente'
                   CHECK (status IN ('pendente','faturado','pago','cancelado')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.17 Travel (Viagens)

```sql
CREATE TABLE travels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  traveler        TEXT NOT NULL,
  destination     TEXT,
  departure_date  DATE,
  return_date     DATE,
  purpose         TEXT,
  estimated_cost  NUMERIC(10,2),
  actual_cost     NUMERIC(10,2),
  status          TEXT DEFAULT 'solicitada'
                   CHECK (status IN ('solicitada','aprovada','realizada','cancelada')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.18 Activity Log

```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.19 AI Settings (por projeto)

```sql
CREATE TABLE ai_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  backend         TEXT DEFAULT 'anthropic'
                   CHECK (backend IN ('ollama','lmstudio','openai','anthropic')),
  ollama_url      TEXT DEFAULT 'http://localhost:11434',
  ollama_model    TEXT DEFAULT 'llama3.2',
  lmstudio_url    TEXT DEFAULT 'http://localhost:1234',
  lmstudio_model  TEXT,
  openai_key      TEXT,
  openai_model    TEXT DEFAULT 'gpt-4o-mini',
  anthropic_key   TEXT,
  anthropic_model TEXT DEFAULT 'claude-sonnet-4-6',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. ESTRUTURA DE PASTAS DO PROJETO

```
src/
├── main.tsx
├── App.tsx
├── index.css
│
├── lib/
│   ├── supabase.ts              # cliente Supabase
│   ├── utils.ts                 # cn(), formatDate(), calcSPI()
│   └── constants.ts             # PHASES, TEMPLATE_KEYS, STATUS_OPTIONS
│
├── i18n/
│   ├── index.ts
│   └── locales/
│       ├── pt-BR.json
│       ├── en.json
│       ├── es.json
│       └── zh.json
│
├── store/
│   ├── authStore.ts             # user, tenant, role
│   ├── projectStore.ts          # projeto ativo, fase ativa
│   └── uiStore.ts               # modais abertos, sidebar
│
├── hooks/
│   ├── useProject.ts
│   ├── useTemplates.ts
│   ├── useIssues.ts
│   ├── useRisks.ts
│   ├── useSchedule.ts
│   ├── useAI.ts
│   └── useTenant.ts
│
├── types/
│   ├── project.ts
│   ├── template.ts
│   ├── schedule.ts
│   ├── issue.ts
│   ├── risk.ts
│   └── tenant.ts
│
├── services/
│   ├── projectService.ts
│   ├── templateService.ts
│   ├── scheduleService.ts
│   ├── issueService.ts
│   ├── riskService.ts
│   ├── aiService.ts             # abstração multi-backend
│   ├── exportService.ts         # PDF, PPTX, Excel, JSON
│   └── tenantService.ts
│
├── components/
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── progress.tsx
│   │   └── ...
│   │
│   ├── layout/
│   │   ├── Header.tsx           # header global com KPIs e botões
│   │   ├── PhaseNav.tsx         # barra de fases
│   │   ├── Footer.tsx           # status realtime
│   │   └── AppShell.tsx         # wrapper geral
│   │
│   ├── auth/
│   │   ├── LoginCard.tsx
│   │   ├── RegisterTab.tsx
│   │   └── ResetPasswordTab.tsx
│   │
│   ├── projects/
│   │   ├── ProjectList.tsx
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectFilters.tsx
│   │   └── ActiveProjectPanel.tsx
│   │
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── KPICards.tsx
│   │   ├── PhaseProgress.tsx
│   │   ├── GanttMini.tsx
│   │   └── ActivityLog.tsx
│   │
│   ├── phases/
│   │   ├── PhaseView.tsx        # container de fase com grid de templates
│   │   └── TemplateCard.tsx     # card clicável de template
│   │
│   ├── templates/
│   │   ├── TemplateModal.tsx    # wrapper modal
│   │   │
│   │   ├── phase1/
│   │   │   ├── KickoffTemplate.tsx
│   │   │   ├── MacroScheduleTemplate.tsx
│   │   │   ├── ScopeDefinitionTemplate.tsx
│   │   │   ├── OrgCommunicationTemplate.tsx
│   │   │   └── QualityGateTemplate.tsx
│   │   │
│   │   ├── phase2/
│   │   │   ├── BPDTemplate.tsx
│   │   │   ├── DetailedScheduleTemplate.tsx
│   │   │   └── QualityGateTemplate.tsx
│   │   │
│   │   ├── phase3/
│   │   │   ├── ExecutionPlanTemplate.tsx
│   │   │   ├── SAPRequestsTemplate.tsx
│   │   │   ├── TestPlanTemplate.tsx
│   │   │   ├── BugControlTemplate.tsx
│   │   │   ├── StatusReportTemplate.tsx
│   │   │   ├── MonitoringTemplate.tsx
│   │   │   └── QualityGateTemplate.tsx
│   │   │
│   │   ├── phase4/
│   │   │   ├── RunbookTemplate.tsx
│   │   │   ├── FinalUATTemplate.tsx
│   │   │   ├── TransitionPlanTemplate.tsx
│   │   │   └── QualityGateTemplate.tsx
│   │   │
│   │   └── phase5/
│   │       ├── HypercareTemplate.tsx
│   │       ├── LessonsLearnedTemplate.tsx
│   │       ├── ProjectClosureTemplate.tsx
│   │       └── QualityGateTemplate.tsx
│   │
│   ├── transversal/
│   │   ├── IssuesModal.tsx
│   │   ├── RisksModal.tsx
│   │   ├── TeamModal.tsx
│   │   ├── CostsModal.tsx
│   │   ├── ChangeRequestsModal.tsx
│   │   ├── BillingModal.tsx
│   │   └── TravelsModal.tsx
│   │
│   ├── schedule/
│   │   ├── GanttChart.tsx       # gráfico Gantt completo
│   │   ├── TaskTable.tsx        # tabela editável de tarefas
│   │   └── GanttTimeline.tsx    # visualização timeline
│   │
│   ├── ai/
│   │   ├── AIPromptSection.tsx  # seção de prompt + resposta IA
│   │   ├── AIBackendConfig.tsx  # configuração de backend (tabs)
│   │   └── AIAnalyzer.tsx       # upload + análise de escopo
│   │
│   └── admin/
│       ├── TenantManager.tsx    # SUPER_ADMIN: gestão de tenants
│       ├── TenantForm.tsx
│       └── UserManager.tsx
│
└── pages/
    ├── AuthPage.tsx
    ├── ProjectsPage.tsx
    ├── DashboardPage.tsx
    ├── PhasePage.tsx            # recebe phase={1..5}
    └── AdminPage.tsx            # SUPER_ADMIN only
```

---

## 6. MÓDULOS E PÁGINAS

### Rotas

```tsx
/                        → redirect para /projetos
/auth                    → AuthPage (login/register/reset)
/projetos                → ProjectsPage (lista de projetos)
/projeto/:id/dashboard   → DashboardPage
/projeto/:id/fase/:num   → PhasePage (1 a 5)
/admin                   → AdminPage (SUPER_ADMIN)
```

### Estado Global (Zustand)

```ts
// authStore
interface AuthStore {
  user: User | null
  profile: UserProfile | null
  tenant: Tenant | null
  role: 'USER' | 'ADM' | 'SUPER_ADMIN' | null
  login: (email, password) => Promise<void>
  logout: () => void
}

// projectStore
interface ProjectStore {
  projects: Project[]
  activeProject: Project | null
  activePhase: number
  filters: ProjectFilters
  setActiveProject: (project: Project) => void
  setActivePhase: (phase: number) => void
}
```

---

## 7. TEMPLATES POR FASE (27 total)

### Lógica comum a todos os templates

```ts
interface TemplateState {
  status: 'pending' | 'in_progress' | 'completed'
  data: Record<string, any>    // JSONB no Supabase
}

// Todo template tem:
// 1. Seção de prompt IA (colapsável)
// 2. Campos do template
// 3. Botões: "✓ Concluído" | "🖨 Imprimir" | "Fechar"
// 4. Auto-save a cada campo alterado (debounce 1s)
// 5. Sincronização com outros templates via dados do projeto
```

### FASE 1 — PREPARE (5 templates)

#### T1.1 — Kickoff do Projeto
```ts
interface KickoffData {
  project: string           // auto do setup
  client: string            // auto do setup
  kickoff_date: string
  project_manager: string   // auto do setup
  attendees: string
  objective: string
  scope: string
  deliverables: string
  team_by_module: TeamModule[]
  expected_result: string
  presentation_content: string  // gerado pela IA
}
```
**Funcionalidades especiais:**
- Seção de prompt IA com botão "Atualizar com dados do Setup"
- Cole resposta do ChatGPT → "Preencher campos" distribui automaticamente
- Timeline Macro: read-only, sincronizado do Cronograma Macro
- Equipe por módulo: editável + sincronizar do Setup
- Exportar apresentação em PPTX

#### T1.2 — Cronograma Macro
```ts
interface MacroTask {
  id: string
  wbs: string
  task_name: string
  phase: 1|2|3|4|5
  start_date: string
  end_date: string
  is_milestone: boolean
  sort_order: number
}
```
**Abas:** Cronograma (tabela) | Timeline (Gantt)
**Controles de visão Gantt:** Dia | Semana | Mês | Trimestre
**Legenda:** linha vermelha hoje, hachurado feriados, cinza fim de semana

#### T1.3 — Definição de Escopo
- Grid 2×2 sincronizado do Kickoff (somente leitura)
- Upload de documento (PDF/DOCX/TXT — até 10MB → Supabase Storage)

#### T1.4 — Organização e Comunicação
```ts
interface CalendarEvent {
  id: string
  title: string
  day: 'seg'|'ter'|'qua'|'qui'|'sex'
  start_time: string  // HH:MM
  duration: number    // minutos
  type: 'diario'|'semanal'|'quinzenal'|'mensal'
  audience: 'gerentes'|'lideres'|'consultores'
  color: string
}
```
**Grid:** 08:00–18:00 em slots de 30min, drag & drop com @dnd-kit

#### T1.5 — Quality Gate Fase 1
```ts
interface QualityGateItem {
  template_key: string
  template_name: string
  is_completed: boolean     // sincronizado do template
  classification: 'sim'|'nao'|'na'|null
  observations: string
}
interface QualityGateData {
  items: QualityGateItem[]
  reviewer: string
  decision: 'aprovada'|'rejeitada'|null
  decided_at: string|null
}
```

---

### FASE 2 — EXPLORE (3 templates)

#### T2.1 — SOW / BPD
- Lista expansível de itens de processo
- Cada item: 7 seções colapsáveis (ver schema bpd_items)
- Configurações Standard SAP: tabela por módulo, checkbox "Em escopo" → cria atividade no Plano de Execução automaticamente
- Botão "Buscar do escopo (IA)"
- Exportar para cliente (PDF com capa)

#### T2.2 — Cronograma Detalhado
- Colunas extras: Sprint, Responsável, Horas Planejadas, Horas Reais, % Concluído, Predecessora
- Cálculo de SPI: `SPI = BCWP / BCWS`
  - BCWP = soma(horas_planejadas × pct_complete/100)
  - BCWS = soma(horas_planejadas × pct_esperado_na_data_corte/100)
- Data de corte configurável
- Exportar Excel

#### T2.3 — Quality Gate Fase 2

---

### FASE 3 — REALIZE (7 templates)

#### T3.1 — Plano de Execução
```ts
interface ExecutionItem {
  id: string
  sprint: string
  title: string
  module: string
  responsible: string[]
  start_date: string
  end_date: string
  status: 'pendente'|'em_andamento'|'concluido'|'bloqueado'
  sap_requests: string[]
  activities: Activity[]
  acceptance: string
  blockers: string
}
```

#### T3.2 — Controle de Requests SAP
- View consolidada (read-only) das requests do Plano de Execução
- Agrupada por módulo SAP

#### T3.3 — Plano de Testes
- SIT / UAT por ciclo e módulo
- Status: pendente | aprovado | reprovado | bloqueado | retest
- KPIs: total, aprovados, reprovados, taxa de aprovação %

#### T3.4 — Controle de Bugs
- Filtros: tipo (SIT/UAT), status, severidade, módulo
- Bug resolvido → passo de teste volta para "pendente" automaticamente
- Severidade: baixa | média | alta | crítica

#### T3.5 — Status Report Semanal
- One Page executivo auto-gerado
- Coleta: atividades atrasadas + bugs em andamento + pendências críticas + riscos altos
- Botão "✦ Gerar com IA" → narrativa executiva
- Exportar PDF

#### T3.6 — Monitoramento e Controle
- Agregação automática de todos os módulos
- KPIs consolidados com pontos de atenção

#### T3.7 — Quality Gate Fase 3

---

### FASE 4 — DEPLOY (4 templates)

#### T4.1 — Runbook de Cutover & Go-Live
- Cronograma por janela: D-30 a D+7
- Transportes de requests SAP
- Plano de carga de dados
- Critérios Go/No-Go
- Plano de contingência
- Importar requests do Plano de Execução

#### T4.2 — Testes Finais UAT
- Resumo automático do Plano de Testes (Fase 3) por módulo/ciclo
- Threshold configurável de aprovação (ex: 95%)

#### T4.3 — Plano de Transição
- Suporte pós go-live
- Plano de treinamentos
- Migração de dados restantes

#### T4.4 — Quality Gate Fase 4

---

### FASE 5 — RUN (4 templates)

#### T5.1 — Hypercare e Estabilização
- Suporte intensivo pós go-live
- Controle de chamados críticos
- Período: D+1 a D+30 (configurável)

#### T5.2 — Lições Aprendidas
- Categorias: positivo | negativo | melhoria
- Votação por membro da equipe
- Exportar relatório

#### T5.3 — Encerramento do Projeto
- Checklist de encerramento
- Termo de aceite formal
- Exportar PDF com assinatura

#### T5.4 — Quality Gate Fase 5

---

## 8. MÓDULOS TRANSVERSAIS

### 8.1 Gestão de Pendências (modal global)

**KPIs:** Abertas | Em Andamento | Resolvidas | Atrasadas

**Filtros:** status chips + responsável dropdown

**Tabela:**
| ID | Descrição | Tipo | Prioridade | Responsável | Aberto por | Data | Prazo | Status |

**Tipos:** decisao | informacao | tarefa | aprovacao | bloqueio
**Prioridades:** baixa | media | alta | critica
**Status:** aberta | em_andamento | resolvida | cancelada

---

### 8.2 Plano de Riscos (modal global)

**KPIs por exposição (Impacto × Probabilidade):**
- 🟢 Baixo (1–3)
- 🟡 Médio (4–6)
- 🟠 Alto (8–9)
- 🔴 Crítico (12–16)

**Tabela:**
| ID | Risco | Categoria | Impacto | Probabilidade | Exposição | Responsável | Mitigação | Contingência | Status |

---

### 8.3 Equipe
- Tabela: Módulo | Consultores/Key-Users | Líder | Email | Senha | Perfil
- Import via Excel (template baixável)
- Botão de travamento (bloqueia edição para todos)

---

### 8.4 Custos
- Descrição | Categoria | Valor | Moeda | Data | Observações
- Total por categoria
- Saldo em relação ao orçamento do projeto

---

### 8.5 Requests / Mudanças (Change Requests)
- Título | Impacto | Solicitante | Status | Data Decisão | Notas

---

### 8.6 Faturamento
- Marco | Valor | Moeda | Vencimento | Data NF | Data Pagamento | Status

---

### 8.7 Viagens
- Viajante | Destino | Saída | Retorno | Motivo | Custo Est. | Custo Real | Status

---

## 9. SISTEMA DE IA (multi-backend)

### aiService.ts — abstração unificada

```ts
interface AIConfig {
  backend: 'ollama' | 'lmstudio' | 'openai' | 'anthropic'
  ollama_url?: string
  ollama_model?: string
  lmstudio_url?: string
  lmstudio_model?: string
  openai_key?: string
  openai_model?: string
  anthropic_key?: string
  anthropic_model?: string
}

async function generateCompletion(
  prompt: string,
  config: AIConfig,
  systemPrompt?: string
): Promise<string>
```

### Casos de uso de IA

| Caso | Onde | Prompt base |
|------|------|-------------|
| Análise de escopo | Setup passo 2 | Extrai riscos, timeline e resumo do documento |
| Geração de Kickoff | T1.1 | Gera conteúdo da apresentação a partir dos dados do projeto |
| Busca no escopo | BPD T2.1 | Preenche campos do BPD a partir do documento de escopo |
| Status Report | T3.5 | Narrativa executiva a partir dos dados coletados |
| Distribuição de resposta | Todos os templates | Distribui resposta do GPT colada nos campos corretos |

### Modelos suportados

**Ollama:** qwen2.5vl, llama3.2, llama3.1, mistral, gemma2, qwen2.5, phi3, deepseek-r1
**LM Studio:** qualquer modelo carregado localmente
**OpenAI:** gpt-4o-mini, gpt-4o, gpt-4-turbo
**Anthropic:** claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-7

---

## 10. SISTEMA DE AUTENTICAÇÃO E PERFIS

### Fluxo de auth

```
1. Usuário acessa /auth
2. Tabs: Entrar | Criar conta | Redefinir senha
3. Login → Supabase Auth → JWT com tenant_id e role
4. user_profiles consultado para obter tenant e role
5. Redirect para /projetos
```

### Regras de acesso

| Ação | USER | ADM | SUPER_ADMIN |
|------|------|-----|-------------|
| Ver projetos liberados | ✓ | ✓ | ✓ |
| Criar/editar projeto | — | ✓ | ✓ |
| Promover usuários | — | ✓ | ✓ |
| Deletar dados | — | ✓ | ✓ |
| Gerenciar tenants | — | — | ✓ |
| Ver todos os tenants | — | — | ✓ |

### Política RLS (padrão para todas as tabelas)

```sql
-- Leitura: apenas dados do próprio tenant
CREATE POLICY "select_own_tenant" ON [tabela]
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
  );

-- Escrita: apenas ADM ou SUPER_ADMIN
CREATE POLICY "write_adm_only" ON [tabela]
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('ADM','SUPER_ADMIN')
  );
```

---

## 11. DASHBOARD AUTOMÁTICO E KPIs

### Cálculo de SPI

```ts
function calcSPI(tasks: ScheduleTask[], cutoffDate: Date): number {
  const bcwp = tasks.reduce((sum, t) =>
    sum + (t.planned_hours * t.pct_complete / 100), 0)

  const bcws = tasks.reduce((sum, t) => {
    const expectedPct = calcExpectedPct(t.start_date, t.end_date, cutoffDate)
    return sum + (t.planned_hours * expectedPct / 100)
  }, 0)

  return bcws > 0 ? bcwp / bcws : 1
}

// RAG baseado no SPI
function calcRAG(spi: number): 'green' | 'yellow' | 'red' {
  if (spi >= 0.95) return 'green'
  if (spi >= 0.80) return 'yellow'
  return 'red'
}
```

### Cards KPI do Dashboard

| Card | Fonte | Cálculo |
|------|-------|---------|
| Templates concluídos | tabela templates | COUNT(status='completed') / 27 |
| Fase atual | projeto | current_phase + datas do cronograma macro |
| Dias até Go-Live | projeto | go_live_date - today |
| Status RAG | cronograma detalhado | SPI calculado |
| Progresso por fase | cronograma detalhado | média % concluído das tarefas da fase |

### Realtime (Supabase)

```ts
// Subscription em tempo real
supabase
  .channel('project-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'templates',
    filter: `project_id=eq.${projectId}`
  }, handleChange)
  .subscribe()

// Sync a cada 30s como fallback
setInterval(syncProject, 30_000)
```

---

## 12. WHITE LABEL — CUSTOMIZAÇÃO POR TENANT

### Variáveis CSS dinâmicas (injetadas no carregamento)

```ts
function applyTenantTheme(tenant: Tenant) {
  const root = document.documentElement
  root.style.setProperty('--color-primary', tenant.primary_color)
  root.style.setProperty('--color-secondary', tenant.secondary_color)
  document.title = tenant.app_name
  // Favicon
  const link = document.querySelector("link[rel~='icon']")
  if (link) link.href = tenant.favicon_url || '/favicon.ico'
}
```

### Resolução de tenant

```ts
// Por subdomínio: cast.seuapp.com → slug='cast'
// Por custom domain: portal.cast.com.br → custom_domain match
// Por path: seuapp.com/t/cast → slug='cast'

async function resolveTenant(): Promise<Tenant> {
  const hostname = window.location.hostname
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .or(`slug.eq.${getSlugFromHost(hostname)},custom_domain.eq.${hostname}`)
    .single()
  return data
}
```

### Painel Admin de Tenants (SUPER_ADMIN)

Tela `/admin`:
- Lista de tenants com status (ativo/inativo)
- Criar novo tenant: nome, slug, cores, logo, domínio
- Criar primeiro ADM do tenant
- Ver métricas: nº projetos, nº usuários, última atividade

---

## 13. PROMPTS PARA O CODEX (build por etapas)

### PROMPT 1 — Inicialização do projeto

```
Crie um projeto React + Vite + TypeScript com Tailwind CSS e Supabase.

Estrutura de pastas conforme especificado.
Instale as dependências: react-router-dom, @supabase/supabase-js, zustand, 
@tanstack/react-query, lucide-react, date-fns, recharts, i18next, react-i18next,
@dnd-kit/core, @dnd-kit/sortable, jspdf, xlsx, pptxgenjs, clsx, tailwind-merge.

Configure:
- Tailwind com CSS variables para tema dinâmico (white label)
- Supabase client em src/lib/supabase.ts com env vars VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
- React Router com as rotas: /auth, /projetos, /projeto/:id/dashboard, /projeto/:id/fase/:num, /admin
- Zustand stores: authStore, projectStore, uiStore
- i18next com pt-BR como padrão
```

### PROMPT 2 — Schema do banco Supabase

```
Execute este SQL no Supabase para criar todas as tabelas:
[colar o schema completo da seção 4 deste documento]

Após criar as tabelas, configure RLS em todas elas conforme as policies
da seção 10 deste documento.

Crie também a função para injetar tenant_id e role no JWT:
[incluir função JWT hook do Supabase]
```

### PROMPT 3 — Autenticação e layout base

```
Implemente o sistema de autenticação:
1. AuthPage (/auth) com 3 tabs: Entrar | Criar conta | Redefinir senha
2. Card central sobre fundo azul-violeta
3. Toggle de idioma no canto superior direito
4. Ao fazer login, buscar user_profiles para obter tenant_id e role
5. Aplicar tema do tenant (primary_color, logo, app_name) via CSS variables
6. AppShell com Header global, PhaseNav e Footer com status realtime
7. Header: logo/nome à esquerda, botões Pendências + Riscos + Idioma + Avatar + Sair à direita
8. Footer: badge "GESTÃO SISTÊMICA" + indicador realtime "🟢 Realtime ON (N)"
```

### PROMPT 4 — Lista de projetos

```
Implemente a ProjectsPage (/projetos):
1. Header: "Meus Projetos" + botões Filtrar + Backup + contador
2. Painel de filtros colapsável: Cliente, Consultoria, GP, Projeto, Fase, Farol, Situação
3. Grid de ProjectCard com: badge fase, badge status, nome, cliente, consultoria, GP,
   Dias Go-Live (calculado), contadores (pendências/bugs/atrasos), SPI, barra de progresso, RAG
4. Botões por card: Abrir | Encerrar | Lixeira
5. Botões globais: + Novo Projeto | Importar JSON | Exportar JSON
6. Painel do Projeto Ativo abaixo da lista com KPIs e chips transversais
7. Modal de criação de projeto: wizard 4 passos (ver seção 9 desta spec)
```

### PROMPT 5 — Dashboard automático

```
Implemente o DashboardPage (/projeto/:id/dashboard):
1. Header com botões Atualizar e Exportar Relatório
2. KPI cards: Templates concluídos | Fase atual | Dias até Go-Live | Status RAG
   Todos com badge "AUTO" e cálculo automático conforme seção 11 desta spec
3. Barras de progresso por fase (Prepare/Explore/Realize/Deploy/Run)
4. Mini Gantt das 5 fases com barras coloridas e datas
5. Seção de Riscos Críticos/Altos (filtro automático de exposure >= 8)
6. Log de Atividades cronológico
7. Subscription realtime no canal do projeto
```

### PROMPT 6 — Fases e grid de templates

```
Implemente a PhasePage (/projeto/:id/fase/:num):
1. Badge colorido da fase + título + descrição + contador de templates
2. Barra de progresso da fase
3. Grid responsivo de TemplateCard (2–4 por linha)
4. Cada TemplateCard: ícone + nome + descrição + status (Concluído/Abrir/Pendente)
5. Clique abre TemplateModal com o template correto
6. Implementar PhaseNav (sub-nav) com as 5 fases + Início
```

### PROMPT 7 — Templates Fase 1 (Prepare)

```
Implemente os 5 templates da Fase 1:

T1.1 KickoffTemplate: seção prompt IA colapsável, campos de identificação,
objetivo, escopo, entregas, timeline macro (read-only sincronizado),
equipe por módulo (editável), resultado esperado, exportar PPTX.

T1.2 MacroScheduleTemplate: tabela de tarefas com WBS + 2 abas (Cronograma/Timeline),
Gantt com visão Dia/Semana/Mês/Trimestre, linha de hoje, milestones em diamante.

T1.3 ScopeDefinitionTemplate: grid 2×2 sincronizado do Kickoff (read-only),
upload de documento para Supabase Storage.

T1.4 OrgCommunicationTemplate: grade semanal 08:00–18:00 em slots 30min,
eventos arrastáveis com @dnd-kit, legenda por tipo de recorrência e público.

T1.5 QualityGateTemplate: lista de templates da fase com status sincronizado,
classificação Sim/Não/N/A por entregável, campo aprovador, decisão Aprovar/Rejeitar.
```

### PROMPT 8 — Template BPD (Fase 2)

```
Implemente o BPDTemplate (T2.1):
Lista expansível de itens de processo, cada item com 7 seções colapsáveis:
Identificação, Equipe, Documento, Definição do Processo, Solução Proposta
(com tabela de Configurações Standard SAP por módulo e checkbox "Em escopo"
que cria automaticamente atividade no Plano de Execução), Cenários/Dependências,
Critérios e Limites.
Botão "Buscar do escopo (IA)" que usa o documento uploadado na Definição de Escopo.
Export PDF para cliente com capa do projeto.
```

### PROMPT 9 — Módulos transversais

```
Implemente os 7 modais transversais como Dialog do Radix UI,
acessíveis globalmente via Header (Pendências e Riscos) e chips do projeto ativo:

IssuesModal: KPIs (Abertas/Em Andamento/Resolvidas/Atrasadas), filtros por chip e
responsável, tabela com colunas ID/Descrição/Tipo/Prioridade/Responsável/Prazo/Status,
formulário de criação inline, auto-save.

RisksModal: KPIs por exposição coloridos (Baixo/Médio/Alto/Crítico),
fórmula Impacto×Probabilidade (1–16), tabela completa com planos de mitigação e contingência.

TeamModal: tabela editável com módulo/consultores/líder/email/senha/perfil,
import Excel, botão de travamento.

CostsModal, ChangeRequestsModal, BillingModal, TravelsModal: conforme seção 8.
```

### PROMPT 10 — Sistema de IA multi-backend

```
Implemente o aiService.ts com abstração para 4 backends:
- Ollama: POST http://[url]/api/generate com stream
- LM Studio: POST http://[url]/v1/chat/completions (OpenAI-compatible)
- OpenAI: POST https://api.openai.com/v1/chat/completions
- Anthropic: POST https://api.anthropic.com/v1/messages

Implemente AIBackendConfig (tabs Ollama/LM Studio/OpenAI/Anthropic) com:
- Campos de configuração por backend
- Botão "Testar conexão" com feedback visual
- Download de scripts para servidor Ollama local (Mac/Win/Linux)

Salvar configuração em ai_settings no Supabase por projeto.

Implementar AIPromptSection reutilizável:
- Área de prompt pré-gerado (editável)
- Botões: Copiar prompt | Atualizar com dados do Setup
- Textarea para colar resposta
- Botão "Preencher campos" que distribui o conteúdo pelos campos do template
```

### PROMPT 11 — White label e painel admin

```
Implemente o sistema white label:
1. Resolução de tenant por subdomínio/custom domain/path na inicialização do app
2. Aplicação de tema (primary_color, logo, app_name) via CSS variables no :root
3. Tenant persistido no authStore

Implemente AdminPage (/admin) para SUPER_ADMIN:
1. Lista de tenants com status, nº projetos, nº usuários
2. Form de criação: nome, slug, primary_color, secondary_color, app_name,
   app_subtitle, logo_url, favicon_url, custom_domain
3. Criação do primeiro ADM do tenant
4. Ativar/desativar tenant
```

### PROMPT 12 — Exportações

```
Implemente o exportService.ts com:

1. exportProjectJSON(projectId): exporta todos os dados do projeto em JSON estruturado
2. importProjectJSON(json, tenantId): restaura projeto a partir do JSON
3. exportDashboardPDF(projectId): relatório executivo em PDF com KPIs, Gantt e riscos
4. exportTemplatePDF(templateData): impressão de qualquer template
5. exportPPTX(kickoffData): apresentação de kickoff com slides por seção
6. exportExcel(scheduleData): cronograma detalhado com todas as colunas
7. exportTeamExcel(): template Excel para importação de equipe (com headers corretos)
```

---

## NOTAS FINAIS PARA O CODEX

1. **Auto-save:** Todo campo que muda dispara um debounce de 1s e salva no Supabase
2. **Realtime:** Subscription ativa no projeto aberto, fallback de sync a cada 30s
3. **Idioma:** i18next com detecção automática; projeto pode ter idioma próprio
4. **Responsivo:** Mobile-first, modais com scroll interno, tabelas com overflow-x
5. **Acessibilidade:** Usar semântica correta do Radix UI, aria-labels nos ícones
6. **Segurança:** Nunca expor keys de IA no frontend se backend disponível;
   para Ollama/LM Studio (local), chamada direta é aceitável
7. **Performance:** React.memo nos cards, virtualização em tabelas > 100 linhas
8. **Testes de tenant:** Usar header `X-Tenant-Slug` ou query param `?tenant=slug`
   em desenvolvimento local para simular múltiplos tenants
```
# ADDENDUM — Dados Extraídos dos HTMLs
## Complemento à Spec Principal

---

## A1. DESIGN SYSTEM CONFIRMADO (dos HTMLs)

### Cores exatas
```css
/* Backgrounds */
--bg-base:        #0f1229;   /* body */
--bg-card:        #1a1f3a;   /* .card */
--bg-card2:       #232847;   /* .card2 / header */
--bg-nav:         #12173a;   /* phase nav */
--bg-input:       #0f1229;   /* inputs */
--bg-selected:    #1e2548;   /* row selecionada */
--bg-table-head:  #12173a;   /* thead */

/* Bordas */
--border:         #2e3460;

/* Primária */
--primary:        #3B4FE8;
--primary-hover:  #2d3dd0;

/* Status */
--green:          #10b981;   /* concluído, salvar */
--amber:          #F59E0B;   /* em andamento, IA */
--red:            #ef4444;   /* danger, atrasado */
--purple:         #8b5cf6;   /* Run phase */
--pink:           #ec4899;   /* fase extra */

/* Badges */
--badge-green-bg: #064e3b; --badge-green-txt: #34d399;
--badge-blue-bg:  #1e3a8a; --badge-blue-txt:  #93c5fd;
--badge-amber-bg: #78350f; --badge-amber-txt: #fcd34d;
--badge-red-bg:   #7f1d1d; --badge-red-txt:   #fca5a5;
--badge-gray-bg:  #1f2937; --badge-gray-txt:  #9ca3af;
--badge-crit-bg:  #450a0a; --badge-crit-txt:  #f87171; /* crítico com borda */

/* Texto */
--text-primary:   #e2e8f0;
--text-secondary: #a0aec0;
--text-muted:     #6b7280;
--text-dim:       #4b5563;
```

### Classes de botões
```css
.btn-primary   { background:#3B4FE8; color:#fff; border-radius:8px; padding:10px 20px; font-weight:600; }
.btn-secondary { background:#232847; color:#a0aec0; border:1px solid #2e3460; border-radius:8px; }
.btn-amber     { background:#F59E0B; color:#1a1f3a; border-radius:8px; } /* IA / análise */
.btn-green     { background:#10b981; color:#fff; border-radius:8px; }    /* salvar/finalizar */
.btn-danger    { background:#ef4444; color:#fff; border-radius:6px; }    /* remover */
```

### Cores por fase (Gantt e barras)
```
Fase 1 Prepare:  #10b981 (verde concluído) / #indigo-600
Fase 2 Explore:  #F59E0B (amber)
Fase 3 Realize:  #3B4FE8 (primary, opacity .5)
Fase 4 Deploy:   #8b5cf6 (purple, opacity .5)
Fase 5 Run:      #ec4899 (pink, opacity .5)
```

### AI output box
```css
.ai-output-box {
  background: #0a0d1f;          /* mais escuro que o body */
  border: 1px solid #3B4FE8;   /* borda azul primária */
  border-radius: 10px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.7;
}
```

---

## A2. LAYOUT GLOBAL

### Header (sticky, z-50)
```
bg: #232847 | border-bottom: #2e3460
Left:  logo quadrado 36px (#3B4FE8) + "SP" + nome + subtítulo
Right: badge fase atual | btn Issues (com badge contador) | btn Riscos | btn IA | btn Idioma | avatar | btn Sair
```

### Phase Nav (breadcrumb style)
```
bg: #12173a | border-bottom: #2e3460
Links: Início › 1 Prepare › 2 Explore › 3 Realize › 4 Deploy › 5 Run
ml-auto: badge RAG + SPI + dias go-live
Link ativo: bg #1a1f3a + text white
```

### Footer
```
border-top: #2e3460
Left:  badge "⚙️ GESTÃO SISTÊMICA" + "SAP Activate Portal v2.0"
Right: "© 2026 Parceiro Kynovia" + dot verde + "Realtime ativo"
```

### max-width por página
- Dashboard:    max-w-7xl
- Projetos:     max-w-7xl
- Fase:         max-w-6xl
- Template:     max-w-5xl
- Configuração: max-w-4xl
- Issues/Risks: max-w-7xl

---

## A3. TEMPLATE KICKOFF — ESTRUTURA COMPLETA

### 6 abas (section-tab)
1. 📋 Identificação
2. ✦ Prompt IA
3. 📅 Timeline Macro
4. 👥 Equipe
5. 🎯 Resultado Esperado
6. 📦 Material

### Aba 1 — Identificação
Campos: Nome do Projeto, Cliente, GP, Sponsor, Data Kickoff (datetime-local),
Local/Plataforma, Duração (select: 1h/1h30/2h/3h), Modalidade (Remoto/Presencial/Híbrido),
Objetivo do Kickoff (textarea), Pauta da Reunião (textarea pré-preenchida com 7 itens)

### Aba 2 — Prompt IA
4 tipos de geração (chips):
- 📊 Apresentação PPT
- 📝 Ata de Kickoff
- 📧 E-mail Convite
- ✅ Checklist Pré-Kickoff

Cada tipo tem prompt pré-gerado diferente.
Output box: bg #0a0d1f + border #3B4FE8
Área de colar resposta externa (qualquer IA)

### Aba 3 — Timeline Macro
Tabela read-only: Fase | Início | Fim | Duração | Responsável | Status
Mini Gantt visual com barras coloridas por fase
Botão "Abrir Cronograma Completo →"

### Aba 4 — Equipe
Tabela: Nome | Módulo (badge) | Função | Empresa | Perfil | Líder (✓/—)
Badge "Cliente" verde para key-users do cliente
Perfis: ADMIN (amber) | USER (blue) | VIEWER (gray)

### Aba 5 — Resultado Esperado
Campos: Resultados Esperados (textarea), Critérios de Sucesso (textarea),
Observações/Decisões, Assinaturas (GP + Sponsor — input[type=date])

### Aba 6 — Material
Grid 2×2 de cards:
- ✦ Gerar com IA (btn-amber)
- 📝 Gerar Manual (btn-secondary)
- 📊 Exportar .pptx (btn-primary)
- 📄 Exportar Ata .docx (btn-primary)
Arquivos anexados: lista com nome, tamanho, data + botão baixar
Input file para anexar novos

---

## A4. CRONOGRAMA MACRO — ESTRUTURA COMPLETA

### 2 views (view-tab)
- 📋 Tabela
- 📊 Timeline Gantt

### Tabela
Filtros: busca texto + fase dropdown + status dropdown + contador "N tarefas"
Colunas: WBS (badge azul) | Tarefa/Marco | Fase (badge F1-F5) | Início | Fim | Duração | Responsável | Status | Ações (✏ 🗑)
Linha de fase: bg #12173a + font-bold
Linha de milestone: texto amarelo + ícone ⬦
Linha de tarefa: padding-left 24px (indentado) + text #cbd5e1

### Gantt
3 zooms: Mês | Semana | Trimestre
Legenda de cores: Concluído/Em andamento/Pendente/Atrasado
Milestone: div rotacionado 45deg (losango) em #F59E0B
Today line: 2px solid #ef4444 opacity 0.7
Coluna esquerda: 220px (WBS + nome)
Coluna direita: flex com headers proporcionais aos dias

### Dados reais do projeto (23 tarefas)
WBS 1-5 (fases) + sub-tarefas + milestones QG1-QG5 + 🚀 GO-LIVE
Project Start: 2026-01-15 | Project End: 2026-08-31

---

## A5. BPD (SOW) — ESTRUTURA COMPLETA

### Header
4 KPIs: Total Processos | Concluídos | Em andamento | Pendentes
Filtros: busca + módulo + status + botões Expandir/Recolher todos

### Cada item BPD (accordion)
Header clicável: ícone + nome + responsável + badge status + badge módulo + ▼/▲

6 sub-abas (section-mini-tab) por item:
1. 📋 Identificação: ID, Módulo, Versão, Nome, Prioridade, Tipo, Status
2. 👥 Equipe: Consultor, Key-User, Revisor, Aprovador
3. 📄 Documento: Datas, Referências Legais, Anexar arquivo, Gerar com IA
4. 🔄 Processo: AS-IS (textarea) + TO-BE (textarea) + Gatilhos
5. 💡 Solução: Solução Proposta, GAP Identificado (select), Complexidade (select), Estimativa de Esforço
6. ✅ Critérios: Critérios de Aceite, Limitações/Exclusões, Material de Apoio

Botões por item: Anexar | Gerar com IA | Exportar .docx

### Dados reais (5 processos)
- FI-001 Apuração IBS/CBS (Concluído)
- CO-001 Centro de Custo Tributário (Em andamento)
- FI-002 Geração Obrigações Acessórias (Em andamento)
- FI-003 Contabilização Automática (Concluído)
- CO-002 Relatórios Gerenciais (Pendente)

---

## A6. GESTÃO DE PENDÊNCIAS — ESTRUTURA COMPLETA

### 5 KPI cards clicáveis (filtram tabela)
Total | Abertas (azul) | Em andamento (amber) | Resolvidas (verde) | Atrasadas (vermelho)

### Filtros
Busca texto + Tipo + Prioridade + botão Exportar

### Tipos de issue
Técnica | Processo | Gestão | Cliente | Escopo

### Prioridades (com badges)
- Crítica: badge-red 🔴
- Alta:    badge-amber 🟠
- Média:   badge-blue 🟡
- Baixa:   badge-gray 🟢

### Status (com badges)
- Aberta:       badge-blue "○ Aberta"
- Em andamento: badge-amber "▶ Em andamento"
- Resolvida:    badge-green "✓ Resolvida"
- Atrasada:     badge-red "⚠ Atrasada"
- Cancelada:    badge-gray "✕ Cancelada"

### Tabela
ID (azul claro, ex: ISS-001) | Descrição + fase sublinhada | Tipo | Prioridade | Responsável | Aberto por | Prazo (vermelho se vencido) | Status | Ações
Linha clicável → abre modal de edição

### Modal Nova/Editar Pendência
max-width: 640px
Campos: Descrição (textarea), Tipo, Prioridade, Responsável, Prazo (date),
Status, Fase, Plano de Ação (textarea)

### Dados reais (8 issues)
ISS-001 a ISS-008 com dados reais do projeto LP Brasil

---

## A7. PLANO DE RISCOS — ESTRUTURA COMPLETA

### 4 KPI cards
Total | Baixo 1-3 (verde) | Médio 4-6 (amber) | Alto/Crítico ≥8 (vermelho com badge "⚠ 1 Crítico")

### Matriz de Riscos visual
Grid 5×5 (Impacto × Probabilidade = 1 a 25)
Cores por score:
- 1-3:  #10b981 (verde)
- 4-9:  #F59E0B (amber)
- 10-19: #ef4444 (vermelho)
- 20-25: #450a0a + borda #f87171 (crítico)

### Tabela de riscos
Colunas: ID | Descrição | Categoria | Impacto | Probabilidade | Score (colorido) | Responsável | Status | Plano de Mitigação | Plano de Contingência | Ações

### Modal Novo/Editar Risco
max-width: 660px
Campos: Descrição, Categoria, Impacto (1-5 select), Probabilidade (1-5 select),
Score calculado automaticamente, Responsável, Prazo, Status,
Plano de Mitigação (textarea), Plano de Contingência (textarea)

### Categorias de risco
Técnico | Processo | Gestão | Cliente | Escopo | Regulatório | Financeiro | Recursos

### Status de risco
Aberto | Em mitigação | Mitigado | Aceito | Fechado | Cancelado

---

## A8. CONFIGURAÇÃO DO PROJETO — WIZARD COMPLETO

### Step Indicator visual
Dots: done (verde #10b981 com ✓) | active (azul #3B4FE8) | pending (cinza #2e3460)
Lines: done (verde) | pending (cinza)
Labels: Dados do Projeto | Escopo + IA | Equipe | Stakeholders

### Step 1 — Dados do Projeto
Grid 2 colunas: Nome*, Cliente*, GP*, Fase Atual, Data Início, Data Go-Live,
Metodologia (SAP Activate/Agile/Waterfall/Híbrida), Status Inicial (RAG)
Full width: Objetivo Geral (textarea)

### Step 2 — Escopo + IA
Upload area: drag & drop, PDF/DOCX/XLSX até 10MB
Chips de módulos: FI, CO, MM, SD, PP, HR, BI/BW, BASIS, ABAP, WM (toggle ativo/inativo)
4 providers IA: OpenAI GPT-4 (com Temperature), Anthropic Claude (com Max Tokens),
Google Gemini (com Safety Level), Manual (2 textareas)
Output: 3 cards — Resumo do Escopo | Riscos Identificados | Timeline Estimada

### Step 3 — Equipe
Tabela: Módulo | Consultor | Função | E-mail | Senha | Perfil (ADMIN/USER/VIEWER) | Líder (checkbox) | Remover
+ Importar Excel | + Adicionar Membro | 🔒 Bloquear Equipe
Aviso política de senha mínimo 8 chars

### Step 4 — Stakeholders & Kickoff
Sponsor (nome + email separados)
Key Users (textarea)
Outras Partes Interessadas (textarea)
Seção Kickoff: Data/Hora, Local/Link, Duração, Pauta Principal
Observações Gerais
Botões: Salvar Rascunho | ✓ Finalizar Configuração (btn-green)

---

## A9. PÁGINA DE FASE — ESTRUTURA COMPLETA

### 4 KPI cards
Progresso da Fase (%) + barra | Templates (N total, N concluídos) | Dias na Fase (N de N planejados) | Status (SPI)

### Filtro de templates
Chips: Todos | Concluídos | Pendentes

### Template Card
Status badges: ✓ Concluído (verde) | ▶ Em andamento (amber) | ○ Pendente (cinza) | 🔒 Bloqueado (cinza, opacity 0.6)
Barra de progresso: done=100%, progress=55%, pending/locked=0%
Botão: "Abrir →" (btn-primary) ou "🔒 Bloqueado" (disabled, opacity 0.5)
Hover: border-color #3B4FE8, translateY(-2px), box-shadow azul

### Modal preview
Ao clicar no card: modal simples com descrição + "Abrir Template" + "Fechar"
Template locked: alert "disponível quando fase anterior concluída e QG aprovado"

### Fases e status de badge
- Fase Concluída:  badge-green "Fase Concluída"
- Fase Atual:      badge-blue "Fase Atual"
- Próxima Fase:    badge-gray "Próxima Fase"
- Futura:          badge-gray "Futura"

---

## A10. TEMPLATES ADICIONAIS CONFIRMADOS

### Fase 2 — Análise GAP (não estava na spec original)
Template adicional: 🔍 Análise GAP
Descrição: Mapeamento de lacunas entre requisitos e solução SAP padrão
Status: Em andamento (progress)

### Fase 3 — templates ajustados
- ⚙️ Configuração do Sistema (locked)
- 💻 Desenvolvimentos (RICEFW) (locked)
- 🧪 Testes Unitários (locked)
- 🔗 Testes Integrados (SIT) (locked)
- 📚 Treinamento de Usuários (locked)
- ✅ UAT — Aceite do Usuário (locked)
- 🏁 Quality Gate Fase 3 (locked)

### Fase 4 — templates ajustados
- 🔄 Plano de Cutover (locked)
- 📦 Migração de Dados (locked)
- 🚀 Go-Live (locked)
- 🏁 Quality Gate Fase 4 (locked)

### Fase 5 — templates ajustados
- 🩺 Hypercare (locked)
- 📖 Lições Aprendidas (locked)
- 🏆 Encerramento do Projeto (locked)
- 🏁 Quality Gate Fase 5 (locked)

**Total confirmado: 24 templates (não 27)**
Fase 1: 5 | Fase 2: 4 (incluindo GAP) | Fase 3: 7 | Fase 4: 4 | Fase 5: 4

---

## A11. PROMPTS CODEX ATUALIZADOS

### Paleta Tailwind customizada (tailwind.config.js)
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        base:    '#0f1229',
        card:    '#1a1f3a',
        card2:   '#232847',
        nav:     '#12173a',
        border:  '#2e3460',
        primary: { DEFAULT:'#3B4FE8', hover:'#2d3dd0' },
        success: '#10b981',
        warning: '#F59E0B',
        danger:  '#ef4444',
      }
    }
  }
}
```

### Estrutura de dados PHASES (do JS da página de fase)
```ts
const PHASES: Record<number, Phase> = {
  1: { title:'Fase 1 — Prepare', badge:'Fase Concluída', badgeClass:'badge-green',
       progress:100, days:21, daysPlan:21, spi:'1.05',
       templates: [kickoff, macroSchedule, scopeDefinition, orgComm, qg1] },
  2: { title:'Fase 2 — Explore', badge:'Fase Atual', badgeClass:'badge-blue',
       progress:47, days:18, daysPlan:21, spi:'1.05',
       templates: [bpd, gapAnalysis, detailedSchedule, qg2] },
  3: { title:'Fase 3 — Realize', badge:'Próxima Fase', badgeClass:'badge-gray',
       templates: [config, ricefw, unitTests, sit, training, uat, qg3] },
  4: { title:'Fase 4 — Deploy', badge:'Futura', badgeClass:'badge-gray',
       templates: [cutover, dataMigration, golive, qg4] },
  5: { title:'Fase 5 — Run', badge:'Futura', badgeClass:'badge-gray',
       templates: [hypercare, lessons, closure, qg5] }
}
```

### Dados de Issues (8 registros reais)
ISS-001 a ISS-008 com tipos: Técnica, Processo, Gestão, Cliente, Escopo

### Dados de Cronograma (23 tarefas reais)
WBS 1 a 5 com sub-tarefas e milestones (QG1-QG5 + GO-LIVE 31/08/2026)

---

## A12. QUALITY GATE — ESTRUTURA COMPLETA

### Seletor de fase
Chips: Fase 1 | Fase 2 | Fase 3 | Fase 4 | Fase 5 (carrega QG de qualquer fase dinamicamente)

### 6 KPI cards
Entregáveis (total) | Concluídos (atendidos+N/A) | Classificados | Atendidos (Sim) | Não Atendidos | N/A

### Barra de progresso dinâmica
Cor: verde ≥80% | amber ≥50% | vermelho <50%
Label dinâmico: "✓ Todos obrigatórios atendidos" ou "⚠ N item(ns) obrigatório(s) pendente(s)"

### Checklist por entregável
- Linha: descrição + badge "★ Obrigatório" (amber) ou "Recomendado" (cinza)
- 3 botões de classificação com estados visuais:
  - `.sim`: border+bg verde (#064e3b / #34d399)
  - `.nao`: border+bg vermelho (#7f1d1d / #fca5a5)
  - `.na`:  border+bg cinza (#1f2937 / #9ca3af)
- Bulk actions: "✓ Marcar todos Sim" | "— Marcar todos N/A" | "✕ Limpar"
- Hover na linha: bg #1e2548

### Decisão do QG
- Botão "✕ Rejeitar Fase" (btn-red) — exige observação preenchida, senão alerta
- Botão "✓ Aprovar Fase" (btn-green) — avisa se há obrigatórios não atendidos
- Banner de resultado:
  - Aprovado: bg #064e3b border #10b981 text #34d399
  - Rejeitado: bg #450a0a border #ef4444 text #fca5a5

### Dados reais dos QGs (todos os 5)

**QG Fase 1 (10 itens):**
1★ Kickoff com sponsor e key-users | 2★ Ata assinada | 3★ Cronograma aprovado
4★ Escopo aceito | 5★ Equipe definida | 6★ Plano comunicação
7★ Ambientes SAP disponíveis | 8★ Licenças confirmadas (resp: NÃO)
9 Portal configurado | 10 Riscos identificados
Respostas pré-carregadas: 1-7=sim, 8=nao, 9-10=sim

**QG Fase 2 (11 itens):**
1★ BPDs concluídos | 2★ GAP aprovado | 3★ Solução validada
4★ RICEFW estimados | 5★ Plano migração | 6★ Plano testes
7 Plano treinamento | 8★ Arquitetura documentada | 9 Interfaces especificadas
10★ BPDs assinados | 11 Riscos atualizados
Respostas parciais: 1=sim, 2=na, 3=nao, 11=sim

**QG Fase 3 (12 itens):** todos sem resposta
**QG Fase 4 (6 itens):** todos sem resposta
**QG Fase 5 (8 itens):** todos sem resposta

---

## A13. ASSISTENTE IA — ESTRUTURA COMPLETA

### Layout
- `height: 100vh` com `display: flex; flex-direction: column`
- Chat ocupa flex-1 à esquerda
- Painel de contexto: 280px fixo à direita, `bg: #0d1128`

### Área de chat
**Mensagens:**
- `.msg-user`: bg #1e3a8a, border-radius 16px 16px 4px 16px (bolha direita)
- `.msg-ai`: bg #232847 border #2e3460, border-radius 16px 16px 16px 4px (bolha esquerda)
- Label da IA: texto "✦ Assistente IA — GPT-4 Turbo" em azul #3B4FE8 10px
- Typing indicator: 3 dots animados com keyframe bounce

**Chips de prompts rápidos** (scroll horizontal):
📊 Status do projeto | ⚠️ Principais riscos | 📅 Próximos marcos |
✉️ E-mail de status | 📝 Resumo executivo | 🔍 Analisar BPDs pendentes |
📋 Gerar ata de reunião | 🎯 Sugestões mitigação riscos | 📦 Checklist Quality Gate Fase 2

**Input area:**
- textarea resizable rows=2 (Enter=enviar, Shift+Enter=nova linha)
- Botões: "➤ Enviar" (btn-primary) + "📎 Anexar" (btn-secondary)
- Contador de chars: "N/4000 chars"
- Info contextual: "Contexto: Fase 2 — Explore | GPT-4 Turbo"

### Painel direito (280px)
**3 seções:**

1. **Contexto do Projeto** (key-value pairs):
Projeto, Cliente, GP, Fase (badge), Status (badge RAG), Go-Live (amber), SPI (verde), Progresso %

2. **Provedor de IA** (radio buttons):
- 🟢 OpenAI GPT-4 (dot verde)
- 🟣 Anthropic Claude (dot roxo)
- 🔵 Google Gemini (dot azul)
- Botão "⚙️ Configurar API Keys"

3. **Histórico de conversas** (lista com data):
- Item ativo: bg #1e2548 + border-left 2px #3B4FE8
- Itens: Nome da conversa + data relativa
- Botão "Ver todo histórico"

### Mensagem de boas-vindas (pré-carregada)
"Olá, [Nome]! Tenho acesso ao contexto completo do projeto..."
Lista de capacidades:
- Análise e geração de documentos
- Identificação de riscos
- Rascunhos de e-mails, atas e apresentações
- Resumo de status para stakeholders
- Revisão de BPDs e processos AS-IS/TO-BE
- Consultas sobre SAP Activate e metodologia

### System prompt do assistente IA
O assistente recebe contexto completo do projeto injetado automaticamente:
```
Você é o Assistente IA do projeto [NOME] para o cliente [CLIENTE].
Contexto atual:
- Fase: [FASE] | SPI: [SPI] | Status: [RAG]
- Go-Live: [DATA] | Dias restantes: [N]
- GP: [NOME] | Equipe: [LISTA]
- Issues em aberto: [N] | Riscos críticos: [N]
- BPDs: [N concluídos] de [N total]
Responda sempre em português brasileiro, de forma executiva e objetiva.
```

---

## A14. RISCOS — DETALHES FINAIS

### Matriz 5×5 (corrigido — não 4×4)
Escala 1-5 para impacto E probabilidade, score máximo 25
Faixas de cor:
- 1-4:   #10b981 verde
- 5-9:   #F59E0B amber
- 10-19: #ef4444 vermelho
- 20-25: #450a0a + borda #f87171 crítico

### Status de risco (corrigido)
Identificado | Em mitigação | Mitigado | Ocorrido
(não Fechado/Cancelado como estava na spec original)

### Categorias (corrigidas)
Técnico | Prazo | Recursos | Escopo | Externo | Qualidade

### Dados reais (7 riscos RSK-001 a RSK-007)
RSK-001: Prazo 7 meses (Prazo, 4×4=16, Alto, Em mitigação)
RSK-002: Legislação IBS/CBS (Externo, 5×5=25, CRÍTICO, Identificado)
RSK-003: Equipe distribuída (Recursos, 3×3=9, Médio, Mitigado)
RSK-004: Licenças Tax Compliance (Técnico, 5×3=15, Alto, Em mitigação)
RSK-005: Key-users indisponíveis (Recursos, 3×2=6, Médio, Identificado)
RSK-006: Integração sistema legado (Técnico, 4×2=8, Alto, Identificado)
RSK-007: Buy-in usuários finais (Qualidade, 2×2=4, Baixo, Mitigado)

---

## A15. PROMPT CODEX ADICIONAL — AI ASSISTANT

```
Implemente o AIAssistantPage (/projeto/:id/assistente):

Layout full-height flexbox:
- Chat area (flex-1) à esquerda
- Context panel (280px fixo) à direita com bg #0d1128

Chat:
- Mensagens user: bg #1e3a8a, border-radius 16px 16px 4px 16px, alinhado à direita
- Mensagens IA: bg #232847 border #2e3460, border-radius 16px 16px 16px 4px, alinhado à esquerda
- Label IA: "✦ Assistente IA" em #3B4FE8, 10px
- Typing indicator: 3 dots animados (bounce keyframe)
- Chips de prompt rápido com scroll horizontal (9 chips pré-definidos)
- Input: textarea rows=2, Enter=enviar, Shift+Enter=quebra linha
- Botões: Enviar + Anexar arquivo (PDF/DOCX/XLSX/TXT)
- Contador: N/4000 chars
- Contexto injetado: "Fase 2 — Explore | GPT-4 Turbo"

Context panel (3 seções):
1. Contexto do Projeto: key-value pairs (projeto, cliente, GP, fase, status, go-live, SPI, progresso)
2. Provedor de IA: radio buttons (OpenAI verde, Anthropic roxo, Gemini azul) + btn Configurar
3. Histórico: lista de conversas com data, item ativo com border-left #3B4FE8

System prompt injetado automaticamente no início de cada conversa
com dados completos do projeto ativo.
```

---

## A16. ASSISTENTE IA — DETALHES FINAIS (JS completo)

### Seção "Ações Rápidas" (painel direito, 4ª seção)
6 botões btn-secondary full-width com texto à esquerda:
- 📊 Resumo executivo
- 🚨 Issues críticos
- ✉️ E-mail de status
- 📅 Próximos marcos
- ⏰ Análise de prazo
- 📝 Gerar ata

### Model info (rodapé do painel direito)
Key-value: Modelo | Tokens usados | Sessão (verde "Ativa") | Contexto (8k tokens)
Token counter atualiza a cada mensagem enviada/recebida

### Providers configurados
```ts
const PROVIDERS = {
  openai:    { label:'GPT-4 Turbo',       model:'gpt-4-turbo',               color:'#10b981' },
  anthropic: { label:'Claude 3.5 Sonnet', model:'claude-3-5-sonnet-20241022', color:'#8b5cf6' },
  gemini:    { label:'Gemini 1.5 Pro',    model:'gemini-1.5-pro',             color:'#3b82f6' },
}
```

### Lógica de envio
- `Enter` = enviar | `Shift+Enter` = nova linha
- Delay simulado: 1200ms + random 800ms antes da resposta
- Typing indicator aparece durante o delay
- Ao trocar provider: nota centralizada "— Provedor alterado para X —" no chat
- Upload de arquivo: notifica no chat com nome e tamanho (KB)

### Respostas contextuais (keyword matching)
```ts
// Palavras-chave → resposta específica
'status|progresso|resumo' → status do projeto com dados reais
'risco|risk'              → top 3 riscos com exposição
'marco|prazo|próximo'     → próximos marcos das próximas 4 semanas
default                   → resposta genérica com contexto do projeto
```

### System prompt injetado (template)
```
Você é o Assistente IA do projeto [NOME] para o cliente [CLIENTE].
Fase: [N] | SPI: [X] | Status: [RAG] | Go-Live: [DATA] | Dias: [N]
GP: [NOME] | Issues em aberto: [N] | Riscos críticos: [N]
BPDs: [N concluídos] de [N total]
Responda sempre em português brasileiro, de forma executiva e objetiva.
```

---

## A17. CORREÇÕES FINAIS NA SPEC

### Templates totais: 24 (confirmado)
Fase 1: 5 | Fase 2: 4 (BPD, GAP, Cronograma Detalhado, QG2) | Fase 3: 7 | Fase 4: 4 | Fase 5: 4

### Página de AI Assistant é página separada
Rota: /projeto/:id/assistente
Acessada via botão "✦ IA" no header (presente em todas as páginas)

### Header botões confirmados (todas as páginas internas)
⚠️ Issues (com badge contador amber) | 🎯 Riscos | ✦ IA | 🌐 PT-BR | Avatar | ⏻ Sair

### Prompt Codex adicional — Rota AI Assistant
```
Adicione a rota /projeto/:id/assistente (AIAssistantPage):

Layout: flex 100vh — chat area (flex-1) + context panel (280px, bg #0d1128)

Chat messages:
- user: bg #1e3a8a, border-radius 16px 16px 4px 16px, self-end
- ai: bg #232847 border #2e3460, border-radius 16px 16px 16px 4px, self-start
- AI label: "✦ [Provider Label]" em #3B4FE8 10px bold
- Typing: 3 dots com bounce animation

Chips scroll horizontal (9 prompts pré-definidos)

Input: textarea rows=2, Enter=send, Shift+Enter=newline
Botões: Enviar + Anexar (PDF/DOCX/XLSX/TXT)
Contador: chars/4000

Context panel 4 seções:
1. Contexto do projeto (dados do projeto ativo)
2. Provedor de IA: radio (OpenAI #10b981 / Anthropic #8b5cf6 / Gemini #3b82f6)
   + btn "⚙️ Configurar API Keys"
3. Histórico: lista com item ativo (border-left #3B4FE8)
4. Ações Rápidas: 6 btns full-width

Rodapé painel: Modelo | Tokens usados | Sessão | Contexto

Ao trocar provider: nota centralizada no chat "— Provedor alterado para X —"
Token counter incrementa a cada troca de mensagens
Ao anexar arquivo: mensagem automática da IA sobre o arquivo recebido

API calls reais via aiService.ts com o provider selecionado,
injetando system prompt com contexto completo do projeto.
```
