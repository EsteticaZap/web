import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, onboardingGuard } from './guards/auth.guard';

// Rotas públicas - acessíveis sem autenticação
export const publicRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard] // Redireciona para home se já estiver logado
  },
  {
    path: 'landpage',
    loadComponent: () => import('./landpage/landpage.component').then(m => m.LandpageComponent)
  },
  {
    path: 'agendar/:salonId',
    loadComponent: () => import('./agendar-publico/agendar-publico.component').then(m => m.AgendarPublicoComponent)
  },
  { path: '', redirectTo: '/landpage', pathMatch: 'full' }
];

// Rota de onboarding - requer autenticação mas não requer onboarding completo
export const onboardingRoutes: Routes = [
  {
    path: 'onboarding',
    loadComponent: () => import('./onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [onboardingGuard]
  }
];

// Rotas privadas - requerem autenticação e onboarding completo
export const privateRoutes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'agenda',
    loadComponent: () => import('./agenda/agenda.component').then(m => m.AgendaComponent),
    canActivate: [authGuard]
  },
  {
    path: 'clientes',
    loadComponent: () => import('./clientes/clientes.component').then(m => m.ClientesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'configuracoes',
    loadComponent: () => import('./configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'planos',
    loadComponent: () => import('./planos/planos.component').then(m => m.PlanosComponent),
    canActivate: [authGuard]
  },
];

export const routes: Routes = [
  ...publicRoutes,
  ...onboardingRoutes,
  ...privateRoutes,
  // Rota fallback - redireciona para landpage
  { path: '**', redirectTo: '/landpage' }
];
