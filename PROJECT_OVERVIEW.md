# EstéticaZap — Project Overview for AI Assistants

> Use this document as context when helping with this codebase. It covers architecture, patterns, data models, and conventions.

---

## What Is This?

**EstéticaZap** is a multi-tenant SaaS salon management platform. Each beauty salon owner gets their own workspace (identified by `salonId = user.uid`). The app has two sides:

- **Private (authenticated):** Salon owners manage appointments, clients, staff, and settings.
- **Public (unauthenticated):** Clients book appointments via `/agendar/:salonId`.

**Stack:** Angular 19 · Firebase (Auth + Firestore) · PrimeNG · Chart.js · FullCalendar · Stripe · Azure Static Web Apps (SSR via Angular Universal + Express)

---

## Project Structure

```
D:\EstéticaZap/
├── src/
│   ├── app/
│   │   ├── agenda/                  # Private: appointment calendar
│   │   ├── agendar-publico/         # Public: booking form (/agendar/:salonId)
│   │   ├── atendimento-publico/     # Public: appointment confirmation
│   │   ├── clientes/                # Private: client management
│   │   ├── configuracoes/           # Private: salon settings
│   │   ├── home/                    # Private: dashboard + onboarding modal
│   │   ├── landpage/                # Public: marketing landing page
│   │   ├── login/                   # Public: authentication
│   │   ├── onboarding/              # Onboarding wizard (shown as modal in /home)
│   │   ├── planos/                  # Private: subscription/pricing
│   │   ├── side-menu/               # Shared: sidebar navigation
│   │   ├── layouts/private-layout/  # Wrapper for authenticated routes
│   │   ├── shared/pricing-card/     # Reusable pricing card
│   │   ├── guards/                  # authGuard, noAuthGuard, onboardingGuard
│   │   ├── services/                # Business logic + Firebase access
│   │   ├── interfaces/              # TypeScript models
│   │   ├── utils/phone-utils.ts     # Phone sanitization
│   │   ├── app.routes.ts            # All route definitions
│   │   └── app.config.ts            # Providers (Firebase, PrimeNG, locale)
│   ├── environments/environment.ts  # Firebase config + Stripe keys
│   ├── server.ts                    # Express SSR server + Stripe endpoints
│   └── main.server.ts               # SSR entry point
├── api/                             # Azure Functions (alternative Stripe endpoints)
├── scripts/agendar-lote.mjs         # Dev utility: bulk appointment creation
├── staticwebapp.config.json         # Azure SWA routing (SPA fallback)
└── CLAUDE.md                        # Detailed project instructions
```

---

## Routing

| Path | Auth Required | Component | Notes |
|------|:---:|-----------|-------|
| `/landpage` | No | `LandpageComponent` | Default route |
| `/login` | No (redirect if authed) | `LoginComponent` | `noAuthGuard` |
| `/agendar/:salonId` | No | `AgendarPublicoComponent` | Public booking |
| `/agendamento/:agendamentoId` | No | `AtendimentoPublicoComponent` | Booking confirmation |
| `/onboarding` | Yes | `OnboardingComponent` | Setup wizard |
| `/home` | Yes + Onboarding | `HomeComponent` | Dashboard |
| `/agenda` | Yes + Onboarding | `AgendaComponent` | Calendar |
| `/clientes` | Yes + Onboarding | `ClientesComponent` | Client list |
| `/configuracoes` | Yes + Onboarding | `ConfiguracoesComponent` | Settings |
| `/planos` | Yes + Onboarding | `PlanosComponent` | Subscriptions |

Private routes are wrapped in `PrivateLayoutComponent` (sidebar + content area).

---

## Services

| Service | Responsibility |
|---------|---------------|
| `AuthService` | Firebase Auth, user session, Firestore `users` doc, signals |
| `ClienteService` | CRUD for `clientes` collection; phone normalization |
| `ProfissionalService` | CRUD for `profissionais`; soft delete via `ativo` flag |
| `AgendamentoService` | CRUD for `agendamentos`; availability logic |
| `BloqueioService` | Time blocks (breaks, closures) in `bloqueios` |
| `RelatorioService` | Analytics queries (revenue, top services, etc.) |
| `AssinaturaService` | Reads subscription data |
| `StripeCheckoutService` | Client-side Stripe checkout flow |
| `MigrationService` | Runs on login; migrates legacy data structures |

---

## Firestore Collections

### `users`
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  onboardingCompleted?: boolean;
  configuracoes?: {
    // Salon config: hours, services, interval, etc.
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `clientes`
```typescript
{
  salonId: string;         // Always required — multi-tenancy filter
  nome: string;
  telefone: string;        // Digits only (normalized)
  email?: string;
  avatar?: string;
  dataCadastro: Timestamp;
  ultimaVisita: Timestamp | null;
  totalVisitas: number;
  totalGasto: number;
  servicosRealizados: ServicoRealizado[];
  datasAgendamentos: string[];
  status: 'ativo' | 'inativo';
  observacoes?: string;
  aniversario?: Date | null;
}
```

### `agendamentos`
```typescript
{
  salonId: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  servicos: { id: string; nome: string; valor: number; duracao: number }[];
  data: string;            // 'YYYY-MM-DD'
  horaInicio: string;      // 'HH:MM'
  horaFim: string;         // 'HH:MM'
  status: 'pendente' | 'confirmado' | 'cancelado';
  valorTotal: number;
  duracaoTotal: number;
  createdAt: Timestamp;
}
```

### `profissionais`
```typescript
{
  id?: string;
  salonId: string;
  nome: string;            // 3–100 chars
  foto: string;            // URL
  descricao: string;       // 10–500 chars
  interesses: string[];    // 1–10 items, each 2–50 chars
  ativo: boolean;          // Soft delete
  ordem: number;           // Display sort order
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `bloqueios`
```typescript
{
  salonId: string;
  data: string;            // 'YYYY-MM-DD'
  horaInicio: string;
  horaFim: string;
  motivo?: string;
}
```

---

## Key Patterns

### Multi-Tenancy (CRITICAL)
`salonId` is always `user.uid`. Every Firestore query on salon data **must** filter by `salonId`:
```typescript
const q = query(
  collection(this.firestore, 'agendamentos'),
  where('salonId', '==', salonId)
);
```

### Dependency Injection
Always use `inject()`, never constructor injection:
```typescript
private firestore = inject(Firestore);
private authService = inject(AuthService);
```

### Signals (State Management)
```typescript
// Service exposes signals:
currentUser = signal<User | null>(null);
userData = signal<UserData | null>(null);
isAuthenticated = computed(() => !!this.currentUser());

// Component reads with ():
const user = this.authService.currentUser();

// React to changes:
effect(() => {
  const data = this.authService.userData();
  if (data?.onboardingCompleted) this.loadDashboard();
});
```

### Standalone Components
All components use `standalone: true` with explicit `imports: []`. No NgModules.

### SSR Safety
```typescript
constructor(@Inject(PLATFORM_ID) platformId: Object) {
  this.isBrowser = isPlatformBrowser(platformId);
}

ngAfterViewInit() {
  if (!this.isBrowser) return; // Never run browser-only code on server
}
```

### Phone Numbers
Always normalize before storing or querying — use `sanitizePhone()` from `utils/phone-utils.ts`.

### Timestamps
Use `serverTimestamp()` for `createdAt` / `updatedAt` fields.

### Service Return Pattern
```typescript
// Operations that can fail return:
async doSomething(): Promise<{ success: boolean; error?: string }> {}
```

---

## Authentication Flow

1. `AuthService` listens to Firebase Auth state changes
2. On login, loads Firestore `users/{uid}` doc into `userData` signal
3. `MigrationService` runs automatically after login
4. If `userData.onboardingCompleted === false`, `/home` shows the onboarding modal
5. Guards check `isAuthenticated()` and `userData()` signals

Login methods: email/password · Google OAuth · password reset

---

## Public Booking Flow

```
/landpage
  └─> /agendar/:salonId
        Loads: salon config, professionals, services, available slots
        Creates: agendamento + cliente (if new) in Firestore
        Sends: WhatsApp confirmation webhook
        └─> /agendamento/:agendamentoId
              Shows: booking details, confirm/cancel actions
```

---

## Payment / Subscription

- **Client-side:** `StripeCheckoutService` → redirects to Stripe hosted page
- **Server-side:** `POST /api/create-checkout-session` and `GET /api/checkout-session/:id` in Express (`src/server.ts`) or Azure Functions (`/api/`)
- Keys live in `src/environments/environment.ts` (Stripe publishable key + price/product IDs)
- Secret key via `STRIPE_SECRET_KEY` environment variable on server

---

## UI Libraries

| Library | Usage |
|---------|-------|
| **PrimeNG 19** | All UI components (forms, dialogs, tables, etc.) |
| **PrimeIcons** | Icon set |
| **Chart.js + ng2-charts** | Dashboard analytics (bar, horizontal bar, doughnut) |
| **FullCalendar** | Agenda view (daygrid, timegrid, interaction plugins) |

PrimeNG is configured with the **Aura theme** in `app.config.ts`. PT-BR translations are provided for date components.

---

## Development Commands

```bash
npm start                         # Dev server → http://localhost:4200
ng build                          # Production build → dist/estetica-zap/
ng build --configuration development  # Dev build with source maps
npm run serve:ssr:EsteticaZap     # Run SSR Express server (after build)
ng test                           # Karma unit tests

# Create bulk test appointments:
npm run agendar:lote -- --salon-id <ID> --data 2025-06-01 --quantidade 10
```

---

## Deployment (Azure Static Web Apps)

1. Manual `ng build` produces `dist/estetica-zap/browser/` (SSR creates `index.csr.html`, not `index.html`)
2. CI workflow copies `index.csr.html` → `index.html` and `staticwebapp.config.json` into build output
3. Deployed with `skip_app_build: true`
4. `staticwebapp.config.json` handles SPA routing fallback (404 → 200 with app content)

---

## Language & Locale

The entire app is in **Brazilian Portuguese (pt-BR)**. All UI text, error messages, and user-facing strings are in Portuguese. Angular locale is set globally to `pt-BR`.

---

## What to Avoid

- **Never** query Firestore without `salonId` filter on salon collections
- **Never** use constructor injection — always `inject()`
- **Never** run DOM/browser APIs without `isPlatformBrowser()` check (SSR compatibility)
- **Never** store raw phone numbers — always normalize with `sanitizePhone()`
- **Never** add NgModules — all components are standalone
