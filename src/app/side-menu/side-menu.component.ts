import { Component, inject, HostListener, Output, EventEmitter } from '@angular/core';
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
  isMenuOpen = false;

  // Variáveis para controlar o swipe
  private touchStartX = 0;
  private touchEndX = 0;
  private isDragging = false;

  @Output() menuToggle = new EventEmitter<boolean>();

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.menuToggle.emit(this.isMenuOpen);
  }

  closeMenu(): void {
    this.isMenuOpen = false;
    this.menuToggle.emit(false);
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  logout(): void {
    this.authService.logout();
  }

  // Detectar início do toque
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
    this.isDragging = true;
  }

  // Detectar movimento do toque
  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    this.touchEndX = event.touches[0].clientX;
  }

  // Detectar fim do toque
  onTouchEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const swipeDistance = this.touchEndX - this.touchStartX;
    const threshold = 50; // Distância mínima para considerar um swipe

    // Swipe da esquerda para direita (abrir menu)
    if (swipeDistance > threshold && this.touchStartX < 50 && !this.isMenuOpen) {
      this.toggleMenu();
    }
    // Swipe da direita para esquerda (fechar menu)
    else if (swipeDistance < -threshold && this.isMenuOpen) {
      this.closeMenu();
    }
  }

  // Fechar menu ao clicar fora dele (no overlay)
  onOverlayClick(): void {
    this.closeMenu();
  }

  // Fechar menu ao redimensionar para desktop
  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth > 768 && this.isMenuOpen) {
      this.closeMenu();
    }
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
