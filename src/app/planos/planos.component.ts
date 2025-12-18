import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { AssinaturaService, PlanoDetalhes, Assinatura } from '../services/assinatura.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-planos',
  standalone: true,
  imports: [CommonModule, SideMenuComponent],
  templateUrl: './planos.component.html',
  styleUrl: './planos.component.css'
})
export class PlanosComponent implements OnInit {
  assinaturaService = inject(AssinaturaService);
  authService = inject(AuthService);

  planos: PlanoDetalhes[] = [];
  mostrarModalPagamento: boolean = false;
  isLoadingPagamento: boolean = false;

  ngOnInit(): void {
    this.planos = this.assinaturaService.getPlanos();
  }

  isPlanoAtual(nomePlano: string): boolean {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (!assinatura) return nomePlano.toLowerCase() === 'free';
    return assinatura.plano === nomePlano.toLowerCase();
  }

  async selecionarPlano(plano: PlanoDetalhes): Promise<void> {
    // Se for o plano free e já estiver no free, não faz nada
    if (plano.nome.toLowerCase() === 'free' && this.isPlanoAtual('free')) {
      return;
    }

    // Se for o plano pro e já estiver no pro, não faz nada
    if (plano.nome.toLowerCase() === 'pro' && this.isPlanoAtual('pro')) {
      return;
    }

    // Se for o plano pro e estiver no free, mostrar modal de pagamento
    if (plano.nome.toLowerCase() === 'pro') {
      this.mostrarModalPagamento = true;
    }
  }

  fecharModalPagamento(): void {
    this.mostrarModalPagamento = false;
  }

  async confirmarPagamento(): Promise<void> {
    this.isLoadingPagamento = true;

    try {
      // Simular processamento de pagamento
      const resultado = await this.assinaturaService.atualizarParaPro('cartao');

      if (resultado.success) {
        alert('Parabéns! Você agora é um usuário Pro do EstéticaZap!');
        this.fecharModalPagamento();
      } else {
        alert('Erro ao processar pagamento: ' + resultado.error);
      }
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    } finally {
      this.isLoadingPagamento = false;
    }
  }

  getStatusBadgeClass(): string {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (assinatura?.plano === 'pro') {
      return 'badge-pro';
    }
    return 'badge-free';
  }

  getStatusBadgeText(): string {
    const assinatura = this.assinaturaService.assinaturaAtual();
    if (assinatura?.plano === 'pro') {
      return 'Plano Pro Ativo';
    }
    return 'Plano Free';
  }
}
