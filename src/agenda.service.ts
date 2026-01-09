import { initializeApp, getApps } from 'firebase/app';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import { environment } from './environments/environment';

export class AgendaService {
  private firestore = getFirestore(this.getOrInitApp());

  private getOrInitApp() {
    if (getApps().length === 0) {
      return initializeApp(environment.firebase);
    }
    return getApps()[0];
  }

  async confirmarAgendamento(agendamentoId: string): Promise<void> {
    const agendamentoRef = doc(this.firestore, 'agendamentos', agendamentoId);
    await updateDoc(agendamentoRef, { status: 'confirmado' });
  }

  async cancelarAgendamento(agendamentoId: string): Promise<void> {
    const agendamentoRef = doc(this.firestore, 'agendamentos', agendamentoId);
    await updateDoc(agendamentoRef, { status: 'cancelado' });
  }
}
