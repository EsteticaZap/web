import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';

/**
 * Guard funcional para proteger rotas que requerem autenticação.
 * Redireciona para a página de login se o usuário não estiver autenticado.
 * O onboarding agora é exibido como modal dentro da Home.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      
      if (user) {
        // Usuário autenticado, permite acesso
        // O onboarding será verificado e exibido como modal na Home
        resolve(true);
      } else {
        // Usuário não autenticado, redireciona para login
        router.navigate(['/login'], { 
          queryParams: { returnUrl: state.url } 
        });
        resolve(false);
      }
    });
  });
};

/**
 * Guard funcional para redirecionar usuários já autenticados.
 * Útil para páginas como login e registro, onde usuários logados
 * devem ser redirecionados para a home.
 */
export const noAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      
      if (user) {
        // Usuário já autenticado, redireciona para home
        // O onboarding será verificado e exibido como modal na Home
        router.navigate(['/home']);
        resolve(false);
      } else {
        // Usuário não autenticado, permite acesso à página
        resolve(true);
      }
    });
  });
};

/**
 * Guard para a página de onboarding (mantido para compatibilidade).
 * Agora o onboarding é exibido como modal, então este guard apenas
 * redireciona para home.
 */
export const onboardingGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      
      if (user) {
        // Redireciona para home, onde o modal será exibido se necessário
        router.navigate(['/home']);
        resolve(false);
      } else {
        // Não autenticado, redireciona para login
        router.navigate(['/login']);
        resolve(false);
      }
    });
  });
};
