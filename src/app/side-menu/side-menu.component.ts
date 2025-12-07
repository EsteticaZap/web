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
    const user = this.authService.currentUser();
    if (user?.displayName) {
      return user.displayName;
    }
    // Se não tem displayName, pega a parte antes do @ do email
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuário';
  }

  get userPhotoUrl(): string {
    const user = this.authService.currentUser();
    return user?.photoURL || '';
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
