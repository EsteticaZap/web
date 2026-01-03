import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from '@angular/fire/firestore';

export interface ServicoRealizado {
  servicoId: string;
  servicoNome: string;
  data: string;
  valor: number;
}

export interface Cliente {
  id?: string;
  salonId: string;
  nome: string;
  telefone: string;
  email?: string;
  avatar?: string;
  dataCadastro: Timestamp | Date;
  ultimaVisita: Timestamp | Date | null;
  totalVisitas: number;
  totalGasto: number;
  servicosRealizados: ServicoRealizado[];
  datasAgendamentos: string[];
  status: 'ativo' | 'inativo';
  observacoes?: string;
  aniversario?: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private firestore = inject(Firestore);

  /**
   * Busca um cliente por telefone no salão específico
   */
  async buscarClientePorTelefone(salonId: string, telefone: string): Promise<Cliente | null> {
    try {
      // Normalizar telefone (remover caracteres especiais)
      const telefoneNormalizado = this.normalizarTelefone(telefone);
      
      const clientesRef = collection(this.firestore, 'clientes');
      const q = query(
        clientesRef,
        where('salonId', '==', salonId),
        where('telefone', '==', telefoneNormalizado)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as Cliente;
    } catch (error) {
      console.error('Erro ao buscar cliente por telefone:', error);
      throw error;
    }
  }

  /**
   * Cria um novo cliente
   */
  async criarCliente(cliente: Omit<Cliente, 'id'>): Promise<string> {
    try {
      console.log('Criando cliente com dados recebidos:', cliente);
      
      // Validar campos obrigatórios
      if (!cliente.nome || cliente.nome.trim() === '') {
        throw new Error('Nome do cliente é obrigatório');
      }
      if (!cliente.telefone || cliente.telefone.trim() === '') {
        throw new Error('Telefone do cliente é obrigatório');
      }
      
      // Montar objeto com campos explícitos para garantir que estão sendo salvos
      const clienteData = {
        salonId: cliente.salonId,
        nome: cliente.nome.trim(),  // Campo explícito
        telefone: this.normalizarTelefone(cliente.telefone),  // Campo explícito
        email: cliente.email || '',
        avatar: cliente.avatar || '/girllandpage.png',
        observacoes: cliente.observacoes || '',
        aniversario: cliente.aniversario || null,
        dataCadastro: serverTimestamp(),
        ultimaVisita: null,
        totalVisitas: 0,
        totalGasto: 0,
        servicosRealizados: [],
        datasAgendamentos: [],
        status: 'ativo' as const
      };

      console.log('Dados do cliente a serem salvos:', clienteData);

      const clientesRef = collection(this.firestore, 'clientes');
      const docRef = await addDoc(clientesRef, clienteData);
      
      console.log('Cliente criado com ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      throw error;
    }
  }

  /**
   * Atualiza informações básicas do cliente
   */
  async atualizarCliente(clienteId: string, dados: Partial<Cliente>): Promise<void> {
    try {
      const clienteRef = doc(this.firestore, 'clientes', clienteId);
      await updateDoc(clienteRef, dados);
      console.log('Cliente atualizado:', clienteId);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  /**
   * Remove um cliente definitivamente do Firestore
   */
  async deletarClienteHard(clienteId: string): Promise<void> {
    try {
      const clienteRef = doc(this.firestore, 'clientes', clienteId);
      await deleteDoc(clienteRef);
      console.log('Cliente deletado definitivamente:', clienteId);
    } catch (error) {
      console.error('Erro ao deletar cliente definitivamente:', error);
      throw error;
    }
  }

  /**
   * Registra um novo agendamento no histórico do cliente
   */
  async registrarAgendamento(
    clienteId: string,
    servicos: { id: string; nome: string; valor: number }[],
    dataAgendamento: string,
    valorTotal: number
  ): Promise<void> {
    try {
      const clienteRef = doc(this.firestore, 'clientes', clienteId);
      
      // Buscar cliente atual para atualizar incrementalmente
      const clientesRef = collection(this.firestore, 'clientes');
      const q = query(clientesRef, where('__name__', '==', clienteId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Cliente não encontrado');
      }
      
      const clienteData = snapshot.docs[0].data() as Cliente;
      
      // Preparar novos serviços realizados
      const novosServicosRealizados = servicos.map(s => ({
        servicoId: s.id,
        servicoNome: s.nome,
        data: dataAgendamento,
        valor: s.valor
      }));
      
      // Atualizar dados
      const servicosAtualizados = [
        ...(clienteData.servicosRealizados || []),
        ...novosServicosRealizados
      ];
      
      const datasAtualizadas = [
        ...(clienteData.datasAgendamentos || []),
        dataAgendamento
      ];
      
      await updateDoc(clienteRef, {
        servicosRealizados: servicosAtualizados,
        datasAgendamentos: datasAtualizadas,
        totalVisitas: (clienteData.totalVisitas || 0) + 1,
        totalGasto: (clienteData.totalGasto || 0) + valorTotal,
        ultimaVisita: serverTimestamp()
      });
      
      console.log('Agendamento registrado no histórico do cliente:', clienteId);
    } catch (error) {
      console.error('Erro ao registrar agendamento no cliente:', error);
      throw error;
    }
  }

  /**
   * Lista todos os clientes de um salão
   */
  async listarClientesPorSalao(salonId: string): Promise<Cliente[]> {
    try {
      console.log('Buscando clientes para salonId:', salonId);
      const clientesRef = collection(this.firestore, 'clientes');
      const q = query(clientesRef, where('salonId', '==', salonId));
      
      const snapshot = await getDocs(q);
      console.log(`Encontrados ${snapshot.docs.length} clientes no Firebase`);
      
      const clientes = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Dados brutos do cliente:', doc.id, data);
        return {
          id: doc.id,
          ...data
        } as Cliente;
      });
      
      return clientes;
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      throw error;
    }
  }

  /**
   * Normaliza o telefone removendo caracteres especiais
   */
  private normalizarTelefone(telefone: string): string {
    return telefone.replace(/\D/g, '');
  }
}
