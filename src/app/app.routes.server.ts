import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rotas públicas podem usar prerender
  {
    path: 'landpage',
    renderMode: RenderMode.Prerender
  },
  // Rotas que usam Firebase (Auth, Storage) devem ser renderizadas no cliente
  {
    path: 'login',
    renderMode: RenderMode.Client
  },
  {
    path: 'home',
    renderMode: RenderMode.Client
  },
  {
    path: 'agenda',
    renderMode: RenderMode.Client
  },
  {
    path: 'clientes',
    renderMode: RenderMode.Client
  },
  {
    path: 'configuracoes',
    renderMode: RenderMode.Client
  },
  {
    path: 'onboarding',
    renderMode: RenderMode.Client
  },
  // Rota padrão
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
