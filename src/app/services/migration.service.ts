import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from '@angular/fire/firestore';
import { ProfissionalService } from './profissional.service';

@Injectable({
  providedIn: 'root'
})
export class MigrationService {
  private firestore = inject(Firestore);
  private profissionalService = inject(ProfissionalService);

  /**
   * Migrar salão para sistema multi-profissional
   * Esta migração é executada automaticamente no primeiro login após a atualização
   */
  async migrateToMultiProfessional(salonId: string, userData: any): Promise<void> {
    try {
      console.log('='.repeat(60));
      console.log('Iniciando migração para sistema multi-profissional...');
      console.log('Salão:', salonId);

      // PASSO 1: Verificar se já foi migrado
      const existingProfs = await this.profissionalService.listarPorSalao(salonId);
      if (existingProfs.length > 0) {
        console.log('✓ Migração já executada anteriormente');
        console.log(`  Encontrados ${existingProfs.length} profissional(is) cadastrado(s)`);
        console.log('='.repeat(60));
        return;
      }

      // PASSO 2: Criar profissional padrão com dados do salão
      console.log('Criando profissional padrão...');
      const defaultProfessional = {
        salonId,
        nome: userData.displayName || userData.configuracoes?.nomeSalao || 'Profissional Principal',
        foto: userData.fotoSalao || '/girllandpage.png',
        descricao: userData.configuracoes?.descricao || 'Profissional do salão',
        interesses: ['Beleza', 'Estética'],
        ativo: true,
        ordem: 0
      };

      const profId = await this.profissionalService.criar(defaultProfessional);
      console.log('✓ Profissional padrão criado com ID:', profId);
      console.log('  Nome:', defaultProfessional.nome);

      // PASSO 3: Buscar todos os agendamentos existentes do salão
      console.log('Buscando agendamentos existentes...');
      const agendamentosRef = collection(this.firestore, 'agendamentos');
      const q = query(agendamentosRef, where('salonId', '==', salonId));
      const snapshot = await getDocs(q);

      const totalAgendamentos = snapshot.docs.length;
      console.log(`✓ Encontrados ${totalAgendamentos} agendamento(s) para atualizar`);

      if (totalAgendamentos === 0) {
        console.log('  Nenhum agendamento a migrar');
      } else {
        // PASSO 4: Atualizar agendamentos em lotes de 500 (limite do Firestore)
        console.log('Atualizando agendamentos...');
        const batches = this.chunkArray(snapshot.docs, 500);

        for (let i = 0; i < batches.length; i++) {
          const batch = writeBatch(this.firestore);

          batches[i].forEach(docSnap => {
            batch.update(docSnap.ref, {
              profissionalId: profId,
              profissionalNome: defaultProfessional.nome
            });
          });

          await batch.commit();
          console.log(`  ✓ Lote ${i + 1}/${batches.length} concluído (${batches[i].length} agendamentos)`);
        }

        console.log('✓ Todos os agendamentos atualizados com sucesso');
      }

      // PASSO 5: Marcar salão como migrado
      console.log('Marcando salão como migrado...');
      const userRef = doc(this.firestore, 'users', salonId);
      await updateDoc(userRef, {
        migracaoMultiProfissional: true,
        migracaoData: serverTimestamp()
      });
      console.log('✓ Salão marcado como migrado');

      console.log('='.repeat(60));
      console.log('✓ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60));
    } catch (error) {
      console.error('='.repeat(60));
      console.error('✗ ERRO NA MIGRAÇÃO:');
      console.error(error);
      console.error('='.repeat(60));
      throw new Error('Falha na migração: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  /**
   * Dividir array em chunks menores
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
