# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EstéticaZap is a salon management application built with Angular 19, Firebase, and PrimeNG. The application provides scheduling, client management, and analytics features for beauty salons. It includes both private salon management features and a public booking interface accessible via unique salon URLs.

## Development Commands

### Essential Commands
- `npm start` or `ng serve` - Start development server at http://localhost:4200/
- `ng build` - Build for production (outputs to `dist/`)
- `ng build --configuration development` - Build for development with source maps
- `ng test` - Run unit tests with Karma
- `ng generate component component-name` - Generate new component

### Component Generation
Use Angular CLI schematics for consistency:
- `ng generate component <name>` - Create new component
- `ng generate service <name>` - Create new service
- `ng generate guard <name>` - Create new guard

## Architecture

### Application Structure

The application follows a feature-based structure with standalone components (no NgModules):

- **Public Routes** (`/landpage`, `/login`, `/agendar/:salonId`) - Accessible without authentication
- **Onboarding Route** (`/onboarding`) - Requires authentication, shown as modal in Home for incomplete onboarding
- **Private Routes** (`/home`, `/agenda`, `/clientes`, `/configuracoes`) - Require authentication AND completed onboarding

### Key Architectural Patterns

**1. Routing & Navigation**
- Routes are defined in `src/app/app.routes.ts` and split into: `publicRoutes`, `onboardingRoutes`, and `privateRoutes`
- Three guard types:
  - `authGuard` - Protects private routes, redirects to `/login` if not authenticated
  - `noAuthGuard` - Redirects authenticated users from `/login` to `/home`
  - `onboardingGuard` - Redirects to `/home` where onboarding modal is displayed if needed

**2. Authentication & User Management**
- Authentication is handled by `AuthService` (`src/app/services/auth.service.ts`)
- Uses Angular Signals for reactive state management:
  - `currentUser` - Firebase Auth user
  - `userData` - User data from Firestore (includes `onboardingCompleted` flag and `configuracoes`)
  - `isAuthenticated` - Boolean authentication status
  - `isLoading` - Loading state
- User data is stored in two places:
  - Firebase Auth - For authentication
  - Firestore `users` collection - For application-specific data (settings, onboarding status)
- Authentication methods: email/password, Google OAuth, password reset

**3. State Management**
- No external state management library
- Uses Angular Signals extensively (introduced in Angular 16+)
- Services inject `Auth` and `Firestore` from `@angular/fire` for Firebase operations
- Effects (`effect()`) are used to react to signal changes (see `home.component.ts:81-87`)

**4. Firebase Integration**
- Configured in `src/app/app.config.ts` with providers:
  - `provideFirebaseApp()` - Initialize Firebase
  - `provideAuth()` - Firebase Authentication
  - `provideFirestore()` - Firestore database
- Environment config in `src/environments/environment.ts` (contains Firebase credentials)
- Collections:
  - `users` - User profiles and settings
  - `clientes` - Salon clients
  - `agendamentos` - Appointments/bookings

**5. Server-Side Rendering (SSR)**
- Application supports SSR with Angular Universal
- Entry point: `src/main.server.ts`
- Server routes: `src/app/app.routes.server.ts`
- SSR server: `src/server.ts`
- Run SSR: `npm run serve:ssr:EsteticaZap` (after building)
- Components check `isPlatformBrowser(platformId)` before browser-specific operations (see `home.component.ts:78` and `home.component.ts:94`)

### Component Architecture

**Standalone Components**: All components use `standalone: true` with explicit imports array.

**Key Components**:
- `SideMenuComponent` - Shared navigation, displays user info from `AuthService.userData()` and `AuthService.currentUser()`
- `HomeComponent` - Dashboard with onboarding modal, loads data from Firebase (appointments, stats, charts)
- `OnboardingComponent` - User setup wizard (shown as modal in Home, not standalone route)
- Public booking flow: `LandpageComponent` → `AgendarPublicoComponent` (accessed via `/agendar/:salonId`)

**Data Loading Pattern** (see `home.component.ts`):
```typescript
async ngOnInit() {
  await this.checkOnboarding();
  if (this.isBrowser) {
    await this.carregarDados(); // Loads all dashboard data in parallel
  }
}
```

### Services

**AuthService** (`src/app/services/auth.service.ts`):
- Provides: `login()`, `register()`, `loginWithGoogle()`, `resetPassword()`, `logout()`
- Auto-loads user data from Firestore on auth state change
- Call `refreshUserData()` after updating user document to sync state
- Error messages are translated to Portuguese via `getErrorMessage()`

**ClienteService** (`src/app/services/cliente.service.ts`):
- Manages salon clients in Firestore
- Key methods:
  - `buscarClientePorTelefone(salonId, telefone)` - Find client by phone
  - `criarCliente(cliente)` - Create new client
  - `registrarAgendamento(clienteId, servicos, data, valor)` - Update client history after booking
  - `listarClientesPorSalao(salonId)` - Get all clients for a salon
- Normalizes phone numbers automatically (removes non-digits)

### UI Framework

**PrimeNG** (`primeng` + `@primeng/themes`):
- Configured in `src/app/app.config.ts` with Aura theme
- Portuguese translations provided for date components
- Uses `primeicons` for icons

**Chart.js** (`chart.js` + `ng2-charts`):
- Used for dashboard analytics in `HomeComponent`
- Charts: bar (revenue), horizontal bar (top services), doughnut (payment methods)
- Initialized in `ngAfterViewInit()` with delay to ensure data is loaded

**FullCalendar** (`@fullcalendar/angular`):
- Used for agenda/scheduling views
- Plugins: `daygrid`, `timegrid`, `interaction`

### TypeScript Configuration

- **Strict mode enabled**: All strict TypeScript options are on
- `experimentalDecorators: true` - Required for Angular decorators
- `target: ES2022` and `module: ES2022`
- Locale set to `pt-BR` globally

## Important Patterns & Conventions

### Firebase Operations
- Use `serverTimestamp()` for `createdAt` and `updatedAt` fields
- Always include `salonId` when querying salon-specific data
- Phone numbers are normalized (digits only) before storage/query

### Component Lifecycle with SSR
```typescript
constructor(@Inject(PLATFORM_ID) platformId: Object) {
  this.isBrowser = isPlatformBrowser(platformId);
}

ngAfterViewInit(): void {
  if (!this.isBrowser) return;
  // Browser-only code (DOM manipulation, Chart.js)
}
```

### Signal-based Reactivity
```typescript
// In service
currentUser = signal<User | null>(null);

// In component
authService = inject(AuthService);

// React to changes
effect(() => {
  const user = this.authService.currentUser();
  // React to user changes
});
```

### Error Handling
- Service methods return `{ success: boolean; error?: string }` for operations that can fail
- Errors are logged to console with descriptive messages
- Firebase errors are translated to Portuguese user-friendly messages

## Firestore Data Models

### User Document (`users` collection)
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  onboardingCompleted?: boolean;
  configuracoes?: any;  // Salon settings
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Cliente Document (`clientes` collection)
```typescript
{
  salonId: string;
  nome: string;
  telefone: string;  // Normalized (digits only)
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

### Agendamento Document (`agendamentos` collection)
```typescript
{
  salonId: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  servicos: { id: string; nome: string; valor: number; duracao: number }[];
  data: string;  // YYYY-MM-DD format
  horaInicio: string;  // HH:MM format
  horaFim: string;
  status: 'pendente' | 'confirmado' | 'cancelado';
  valorTotal: number;
  duracaoTotal: number;
  createdAt: Timestamp;
}
```

## Common Tasks

### Adding a New Protected Route
1. Create component: `ng generate component feature-name`
2. Add route to `privateRoutes` array in `src/app/app.routes.ts`
3. Add `canActivate: [authGuard]` to route config
4. Add navigation link to `side-menu.component.html` if needed

### Adding a New Firebase Collection
1. Define TypeScript interface in relevant service
2. Use `collection(this.firestore, 'collection-name')` to reference
3. Always include `salonId` field for multi-tenancy
4. Use `serverTimestamp()` for audit fields

### Updating User Data After Onboarding
```typescript
// Update Firestore document
await updateDoc(doc(this.firestore, 'users', uid), {
  onboardingCompleted: true,
  configuracoes: { /* settings */ }
});

// Refresh AuthService state
await this.authService.refreshUserData();
```

## Production Build

The production build has bundle size limits configured in `angular.json`:
- Initial bundle: 1MB warning, 2MB error
- Component styles: 13kB warning, 20kB error

Output directory: `dist/estetica-zap/browser/` (SSR build outputs to browser and server directories)

### Important Build Notes

**SSR Build Output:**
The Angular application uses Server-Side Rendering (SSR) which generates:
- `dist/estetica-zap/browser/` - Client-side files including `index.csr.html` (not `index.html`)
- `dist/estetica-zap/server/` - Server-side rendering files

**Azure Static Web Apps Deployment:**
The application is configured for Azure Static Web Apps deployment. The workflow (`.github/workflows/azure-static-web-apps-proud-pebble-03297e610.yml`) includes:
1. Manual build step before Azure deployment
2. Automatic copy of `index.csr.html` to `index.html` (required by Azure SWA)
3. Copy of `staticwebapp.config.json` to build output for routing configuration
4. `skip_app_build: true` flag to use pre-built files

**Static Web App Configuration (`staticwebapp.config.json`):**
- Configures fallback routing to `index.csr.html` for SPA navigation
- Handles 404s by serving the Angular app (returns 200 with app content)
- Defines MIME types and caching headers
