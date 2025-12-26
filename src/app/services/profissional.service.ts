import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy
} from '@angular/fire/firestore';
import { Profissional } from '../interfaces/profissional.interface';

@Injectable({
  providedIn: 'root'
})
export class ProfissionalService {
  private firestore = inject(Firestore);

  /**
   * Lista todos os profissionais de um salão (ativos e inativos)
   */
  async listarPorSalao(salonId: string): Promise<Profissional[]> {
    try {
      console.log('Buscando profissionais para salonId:', salonId);
      const profissionaisRef = collection(this.firestore, 'profissionais');
      const q = query(
        profissionaisRef,
        where('salonId', '==', salonId)
      );

      const snapshot = await getDocs(q);
      console.log(`Encontrados ${snapshot.docs.length} profissionais no Firebase`);

      const profissionais = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Profissional));

      // Ordenar localmente por ordem
      profissionais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      return profissionais;
    } catch (error) {
      console.error('Erro ao listar profissionais:', error);
      throw error;
    }
  }

  /**
   * Lista apenas profissionais ativos de um salão (para agendamento público)
   */
  async listarAtivos(salonId: string): Promise<Profissional[]> {
    try {
      console.log('Buscando profissionais ativos para salonId:', salonId);
      const profissionaisRef = collection(this.firestore, 'profissionais');
      const q = query(
        profissionaisRef,
        where('salonId', '==', salonId),
        where('ativo', '==', true)
      );

      const snapshot = await getDocs(q);
      console.log(`Encontrados ${snapshot.docs.length} profissionais ativos no Firebase`);

      const profissionais = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Profissional));

      // Ordenar localmente por ordem
      profissionais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      return profissionais;
    } catch (error) {
      console.error('Erro ao listar profissionais ativos:', error);
      throw error;
    }
  }

  /**
   * Busca um profissional específico por ID
   */
  async buscarPorId(id: string): Promise<Profissional | null> {
    try {
      const profissionalRef = doc(this.firestore, 'profissionais', id);
      const profissionalDoc = await getDoc(profissionalRef);

      if (!profissionalDoc.exists()) {
        return null;
      }

      return {
        id: profissionalDoc.id,
        ...profissionalDoc.data()
      } as Profissional;
    } catch (error) {
      console.error('Erro ao buscar profissional:', error);
      throw error;
    }
  }

  /**
   * Cria um novo profissional
   */
  async criar(profissional: Omit<Profissional, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('Criando profissional com dados recebidos:', profissional);

      // Validar campos obrigatórios
      this.validarProfissional(profissional);

      // Montar objeto com timestamps
      const profissionalData = {
        salonId: profissional.salonId,
        nome: profissional.nome.trim(),
        foto: profissional.foto,
        descricao: profissional.descricao.trim(),
        interesses: profissional.interesses || [],
        ativo: profissional.ativo !== undefined ? profissional.ativo : true,
        ordem: profissional.ordem !== undefined ? profissional.ordem : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Dados do profissional a serem salvos:', profissionalData);

      const profissionaisRef = collection(this.firestore, 'profissionais');
      const docRef = await addDoc(profissionaisRef, profissionalData);

      console.log('Profissional criado com ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar profissional:', error);
      throw error;
    }
  }

  /**
   * Atualiza informações de um profissional
   */
  async atualizar(id: string, dados: Partial<Profissional>): Promise<void> {
    try {
      // Validar se está tentando atualizar campos essenciais
      if (dados.nome !== undefined || dados.descricao !== undefined) {
        this.validarProfissional(dados as any);
      }

      const profissionalRef = doc(this.firestore, 'profissionais', id);
      const dadosAtualizados = {
        ...dados,
        updatedAt: serverTimestamp()
      };

      await updateDoc(profissionalRef, dadosAtualizados);
      console.log('Profissional atualizado:', id);
    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      throw error;
    }
  }

  /**
   * Desativa um profissional (soft delete)
   */
  async desativar(id: string): Promise<void> {
    try {
      const profissionalRef = doc(this.firestore, 'profissionais', id);
      await updateDoc(profissionalRef, {
        ativo: false,
        updatedAt: serverTimestamp()
      });
      console.log('Profissional desativado:', id);
    } catch (error) {
      console.error('Erro ao desativar profissional:', error);
      throw error;
    }
  }

  /**
   * Reativa um profissional
   */
  async reativar(id: string): Promise<void> {
    try {
      const profissionalRef = doc(this.firestore, 'profissionais', id);
      await updateDoc(profissionalRef, {
        ativo: true,
        updatedAt: serverTimestamp()
      });
      console.log('Profissional reativado:', id);
    } catch (error) {
      console.error('Erro ao reativar profissional:', error);
      throw error;
    }
  }

  /**
   * Valida os dados de um profissional
   */
  private validarProfissional(profissional: Partial<Profissional>): void {
    // Validar nome
    if (profissional.nome !== undefined) {
      if (!profissional.nome || profissional.nome.trim() === '') {
        throw new Error('Nome do profissional é obrigatório');
      }
      if (profissional.nome.trim().length < 3) {
        throw new Error('Nome deve ter pelo menos 3 caracteres');
      }
      if (profissional.nome.trim().length > 100) {
        throw new Error('Nome deve ter no máximo 100 caracteres');
      }
    }

    // Validar descrição
    if (profissional.descricao !== undefined) {
      if (!profissional.descricao || profissional.descricao.trim() === '') {
        throw new Error('Descrição do profissional é obrigatória');
      }
      if (profissional.descricao.trim().length < 10) {
        throw new Error('Descrição deve ter pelo menos 10 caracteres');
      }
      if (profissional.descricao.trim().length > 500) {
        throw new Error('Descrição deve ter no máximo 500 caracteres');
      }
    }

    // Validar foto
    if (profissional.foto !== undefined) {
      if (!profissional.foto || profissional.foto.trim() === '') {
        throw new Error('Foto do profissional é obrigatória');
      }
    }

    // Validar interesses
    if (profissional.interesses !== undefined) {
      if (!Array.isArray(profissional.interesses)) {
        throw new Error('Interesses devem ser um array');
      }
      if (profissional.interesses.length < 1) {
        throw new Error('Adicione pelo menos 1 interesse');
      }
      if (profissional.interesses.length > 10) {
        throw new Error('Máximo de 10 interesses permitidos');
      }

      // Validar cada interesse
      profissional.interesses.forEach((interesse, index) => {
        if (typeof interesse !== 'string' || interesse.trim() === '') {
          throw new Error(`Interesse ${index + 1} é inválido`);
        }
        if (interesse.trim().length < 2) {
          throw new Error(`Interesse ${index + 1} deve ter pelo menos 2 caracteres`);
        }
        if (interesse.trim().length > 50) {
          throw new Error(`Interesse ${index + 1} deve ter no máximo 50 caracteres`);
        }
      });
    }
  }
}
