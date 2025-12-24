import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanoDetalhes } from '../../services/assinatura.service';

@Component({
  selector: 'app-pricing-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing-card.component.html',
  styleUrl: './pricing-card.component.css'
})
export class PricingCardComponent {
  @Input() plano!: PlanoDetalhes;
  @Input() isPlanoAtual: boolean = false;
  @Input() mode: 'landpage' | 'app' = 'app'; // Modo landpage não mostra badge de plano atual
  @Output() selectPlan = new EventEmitter<PlanoDetalhes>();

  onSelectPlan(): void {
    if (!this.isPlanoAtual) {
      this.selectPlan.emit(this.plano);
    }
  }

  get buttonText(): string {
    if (this.isPlanoAtual) {
      return 'Plano Atual';
    }

    if (this.mode === 'landpage') {
      return this.plano.preco === 0 ? 'Começar Grátis' : 'Testar 14 dias grátis';
    }

    return this.plano.nome === 'Pro' ? 'Fazer Upgrade' : 'Selecionar Plano';
  }

  get buttonIcon(): string {
    if (this.isPlanoAtual) {
      return 'pi-check';
    }

    if (this.mode === 'landpage') {
      return this.plano.preco === 0 ? 'pi-sparkles' : 'pi-star';
    }

    return 'pi-arrow-up-right';
  }
}
