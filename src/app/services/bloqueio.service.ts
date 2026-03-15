import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where
} from '@angular/fire/firestore';
import { BloqueioHorario } from '../interfaces/bloqueio.interface';

@Injectable({
  providedIn: 'root'
})
export class BloqueioService {
  private firestore = inject(Firestore);

  /**
   * Cria um novo bloqueio de horário
   */
  async criar(bloqueio: Omit<BloqueioHorario, 'id' | 'createdAt'>): Promise<string> {
    const bloqueiosRef = collection(this.firestore, 'bloqueios');
    const bloqueioData = {
      ...bloqueio,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(bloqueiosRef, bloqueioData);
    return docRef.id;
  }

  /**
   * Lista todos os bloqueios de um salão
   */
  async listarPorSalao(salonId: string): Promise<BloqueioHorario[]> {
    const bloqueiosRef = collection(this.firestore, 'bloqueios');
    const q = query(bloqueiosRef, where('salonId', '==', salonId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BloqueioHorario));
  }

  /**
   * Lista bloqueios por salão e data específica
   */
  async listarPorSalaoEData(salonId: string, data: string): Promise<BloqueioHorario[]> {
    const bloqueiosRef = collection(this.firestore, 'bloqueios');
    const q = query(
      bloqueiosRef,
      where('salonId', '==', salonId),
      where('data', '==', data)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as BloqueioHorario));
  }

  /**
   * Remove um bloqueio de horário
   */
  async remover(bloqueioId: string): Promise<void> {
    const bloqueioRef = doc(this.firestore, 'bloqueios', bloqueioId);
    await deleteDoc(bloqueioRef);
  }
}
