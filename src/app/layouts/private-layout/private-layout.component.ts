import { Component, Inject, OnInit, PLATFORM_ID, effect, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SideMenuComponent } from '../../side-menu/side-menu.component';
import { OnboardingComponent } from '../../onboarding/onboarding.component';
import { AuthService } from '../../services/auth.service';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SideMenuComponent, OnboardingComponent],
  templateUrl: './private-layout.component.html',
  styleUrls: ['./private-layout.component.css']
})
export class PrivateLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private isBrowser: boolean;

  showOnboarding = false;
  onboardingChecked = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.applyOnboardingStatus(userData);
        this.onboardingChecked = true;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.checkOnboarding();
  }

  private async checkOnboarding(): Promise<void> {
    if (!this.isBrowser) return;

    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    try {
      const userDocRef = doc(this.firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        this.applyOnboardingStatus(userDoc.data());
      } else {
        this.showOnboarding = true;
      }
    } catch (error) {
      console.error('Erro ao verificar onboarding:', error);
    }

    this.onboardingChecked = true;
  }

  private applyOnboardingStatus(userData: any): void {
    this.showOnboarding = !userData['onboardingCompleted'];
  }

  onOnboardingComplete(): void {
    this.showOnboarding = false;
    this.authService.refreshUserData();
  }
}
