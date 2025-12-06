import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landpage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landpage.component.html',
  styleUrls: ['./landpage.component.css']
})
export class LandpageComponent {
  faqs = [
    { question: 'O serviço é realmente grátis no começo?', answer: 'Sim, o plano gratuito oferece agendamentos ilimitados e gestão básica de clientes.', open: false },
    { question: 'Preciso instalar algum aplicativo?', answer: 'Não, basta ter acesso ao WhatsApp Web e internet.', open: false },
    { question: 'Posso cancelar quando quiser?', answer: 'Sim, você pode mudar de plano ou cancelar a qualquer momento.', open: false },
    { question: 'Meus dados estão seguros?', answer: 'Seus dados são criptografados e protegidos conforme as melhores práticas.', open: false }
  ];

  toggleFaq(faq: any): void {
    faq.open = !faq.open;
  }
}
