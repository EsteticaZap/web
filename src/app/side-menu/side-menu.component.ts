import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.css']
})
export class SideMenuComponent {
  authService = inject(AuthService);
  showUserMenu = false;

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.authService.logout();
  }

  get userEmail(): string {
    return this.authService.currentUser()?.email || 'Usuário';
  }

  get userDisplayName(): string {
    const userData = this.authService.userData();
    const currentUser = this.authService.currentUser();
    
    // Priorizar displayName do userData (Firestore)
    if (userData?.displayName) {
      return userData.displayName;
    }
    
    // Fallback para currentUser (Firebase Auth)
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    
    // Se não tem displayName, pega a parte antes do @ do email
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'Usuário';
  }

  get userPhotoUrl(): string {
    const userData = this.authService.userData();
    const currentUser = this.authService.currentUser();
    
    // Priorizar foto do userData (base64 do Firestore)
    if ((userData as any)?.fotoSalao) {
      return (userData as any).fotoSalao;
    }
    
    // Fallback para foto do currentUser (Firebase Auth)
    return currentUser?.photoURL || '';
  }

  get userInitials(): string {
    const name = this.userDisplayName;
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return 'US';
  }
}
