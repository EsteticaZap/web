import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { LandpageComponent } from './landpage/landpage.component';
import { HomeComponent } from './home/home.component';
import { AgendaComponent } from './agenda/agenda.component';
import { ClientesComponent } from './clientes/clientes.component';
import { ConfiguracoesComponent } from './configuracoes/configuracoes.component';
import { OnboardingComponent } from './onboarding/onboarding.component';
import { authGuard, noAuthGuard, onboardingGuard } from './guards/auth.guard';

// Rotas públicas - acessíveis sem autenticação
export const publicRoutes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [noAuthGuard] // Redireciona para home se já estiver logado
  },
  { path: 'landpage', component: LandpageComponent },
  { path: '', redirectTo: '/landpage', pathMatch: 'full' }
];

// Rota de onboarding - requer autenticação mas não requer onboarding completo
export const onboardingRoutes: Routes = [
  {
    path: 'onboarding',
    component: OnboardingComponent,
    canActivate: [onboardingGuard]
  }
];

// Rotas privadas - requerem autenticação e onboarding completo
export const privateRoutes: Routes = [
  { 
    path: 'home', 
    component: HomeComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'agenda', 
    component: AgendaComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'clientes', 
    component: ClientesComponent,
    canActivate: [authGuard]
  },
  { 
    path: 'configuracoes', 
    component: ConfiguracoesComponent,
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
