import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  
  // Controle de modo (login ou registro)
  isRegisterMode: boolean = false;
  confirmPassword: string = '';
  displayName: string = ''; // Nome do salão ou da pessoa

  // URL de retorno após login
  private returnUrl: string = '/home';

  constructor() {
    // Capturar URL de retorno se existir
    this.route.queryParams.subscribe(params => {
      this.returnUrl = params['returnUrl'] || '/home';
    });
  }

  toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.errorMessage = '';
    this.successMessage = '';
    this.displayName = '';
    this.confirmPassword = '';
  }

  async onSubmit(): Promise<void> {
    // Validações básicas
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, preencha todos os campos.';
      return;
    }

    if (this.isRegisterMode) {
      if (!this.displayName || !this.displayName.trim()) {
        this.errorMessage = 'Por favor, informe o nome do salão ou seu nome.';
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMessage = 'As senhas não coincidem.';
        return;
      }
      if (this.password.length < 6) {
        this.errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        return;
      }
      await this.register();
    } else {
      await this.login();
    }
  }

  private async login(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    const result = await this.authService.login(this.email, this.password);
    
    this.isLoading = false;

    if (result.success) {
      this.router.navigate([this.returnUrl]);
    } else {
      this.errorMessage = result.error || 'Erro ao fazer login.';
    }
  }

  private async register(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    const result = await this.authService.register(
      this.email, 
      this.password, 
      this.displayName.trim()
    );
    
    this.isLoading = false;

    if (result.success) {
      this.successMessage = 'Conta criada com sucesso! Redirecionando...';
      setTimeout(() => {
        this.router.navigate([this.returnUrl]);
      }, 1500);
    } else {
      this.errorMessage = result.error || 'Erro ao criar conta.';
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    const result = await this.authService.loginWithGoogle();
    
    this.isLoading = false;

    if (result.success) {
      this.router.navigate([this.returnUrl]);
    } else {
      this.errorMessage = result.error || 'Erro ao fazer login com Google.';
    }
  }

  async forgotPassword(): Promise<void> {
    if (!this.email) {
      this.errorMessage = 'Digite seu email para recuperar a senha.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const result = await this.authService.resetPassword(this.email);
    
    this.isLoading = false;

    if (result.success) {
      this.successMessage = 'Email de recuperação enviado! Verifique sua caixa de entrada.';
    } else {
      this.errorMessage = result.error || 'Erro ao enviar email de recuperação.';
    }
  }

  loginWithFacebook(): void {
    // Facebook login não implementado ainda
    this.errorMessage = 'Login com Facebook ainda não está disponível.';
  }
}
