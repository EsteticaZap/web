import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, onboardingGuard } from './guards/auth.guard';
import { PrivateLayoutComponent } from './layouts/private-layout/private-layout.component';

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
    path: '',
    component: PrivateLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./agenda/agenda.component').then(m => m.AgendaComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'configuracoes',
        loadComponent: () => import('./configuracoes/configuracoes.component').then(m => m.ConfiguracoesComponent)
      },
      {
        path: 'planos',
        loadComponent: () => import('./planos/planos.component').then(m => m.PlanosComponent)
      }
    ]
  }
];

export const routes: Routes = [
  ...publicRoutes,
  ...onboardingRoutes,
  ...privateRoutes,
  // Rota fallback - redireciona para landpage
  { path: '**', redirectTo: '/landpage' }
];
