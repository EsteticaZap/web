import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDQEmzWVRxmJBhEAvkG63ZBC9Mfu25CGM4',
  authDomain: 'esteticazap.firebaseapp.com',
  projectId: 'esteticazap',
  storageBucket: 'esteticazap.firebasestorage.app',
  messagingSenderId: '631624311274',
  appId: '1:631624311274:web:da6e92b91432fd6b689293',
  measurementId: 'G-V8VC63YCB4'
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

const DEFAULTS = {
  quantidade: 5,
  horaInicio: '09:00',
  clientePrefixo: 'Cliente Teste',
  telefoneBase: '1199990000'
};

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const [key, inlineValue] = arg.split('=');
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, 'true');
    }
  }
  return args;
}

function getRequiredArg(args, key, label) {
  const value = args.get(key);
  if (!value) {
    throw new Error(`Parâmetro obrigatório ausente: ${label}`);
  }
  return value;
}

function normalizePhone(value) {
  return String(value).replace(/\D/g, '');
}

function parseDuration(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric >= 100 && numeric < 1000) {
    const horas = Math.floor(numeric / 100);
    const minutos = numeric % 100;
    return horas * 60 + minutos;
  }
  return numeric;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildScheduleSlots(existing, duration, gap) {
  return existing.map(item => ({
    inicio: timeToMinutes(item.horaInicio),
    fim: timeToMinutes(item.horaFim)
  })).sort((a, b) => a.inicio - b.inicio);
}

function findNextAvailable(startMinutes, slots, duration, gap) {
  let current = startMinutes;
  let changed = true;
  while (changed) {
    changed = false;
    for (const slot of slots) {
      const slotFimComGap = slot.fim + gap;
      const terminaAntes = current + duration <= slot.inicio;
      const comecaDepois = current >= slotFimComGap;
      if (terminaAntes || comecaDepois) {
        continue;
      }
      current = slotFimComGap;
      changed = true;
      break;
    }
  }
  return current;
}

async function carregarSalao(salonId) {
  const ref = doc(firestore, 'users', salonId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('Salão não encontrado para o ID informado.');
  }
  return snapshot.data();
}

async function carregarProfissional(salonId, profissionalId) {
  if (profissionalId) {
    const ref = doc(firestore, 'profissionais', profissionalId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) {
      throw new Error('Profissional não encontrado para o ID informado.');
    }
    return { id: snapshot.id, ...snapshot.data() };
  }

  const profissionaisRef = collection(firestore, 'profissionais');
  const q = query(
    profissionaisRef,
    where('salonId', '==', salonId),
    where('ativo', '==', true)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Nenhum profissional ativo encontrado para o salão informado.');
  }
  const [primeiro] = snapshot.docs;
  return { id: primeiro.id, ...primeiro.data() };
}

async function carregarServicos(salonId, servicoIds) {
  if (servicoIds.length > 0) {
    const servicos = [];
    for (const id of servicoIds) {
      const ref = doc(firestore, 'servicos', id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new Error(`Serviço não encontrado: ${id}`);
      }
      servicos.push({ id: snapshot.id, ...snapshot.data() });
    }
    return servicos;
  }

  const servicosRef = collection(firestore, 'servicos');
  const q = query(
    servicosRef,
    where('userId', '==', salonId),
    where('ativo', '==', true)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Nenhum serviço ativo encontrado para o salão informado.');
  }
  const [primeiro] = snapshot.docs;
  return [{ id: primeiro.id, ...primeiro.data() }];
}

async function carregarAgendamentosExistentes(salonId, profissionalId, data) {
  const agendamentosRef = collection(firestore, 'agendamentos');
  const q = query(
    agendamentosRef,
    where('salonId', '==', salonId),
    where('profissionalId', '==', profissionalId),
    where('data', '==', data)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

async function criarCliente({ salonId, nome, telefone }) {
  const clientesRef = collection(firestore, 'clientes');
  const clienteData = {
    salonId,
    nome: nome.trim(),
    telefone: normalizePhone(telefone),
    email: '',
    avatar: '/girllandpage.png',
    observacoes: '',
    aniversario: null,
    dataCadastro: serverTimestamp(),
    ultimaVisita: null,
    totalVisitas: 0,
    totalGasto: 0,
    servicosRealizados: [],
    datasAgendamentos: [],
    status: 'ativo'
  };
  const docRef = await addDoc(clientesRef, clienteData);
  return docRef.id;
}

async function registrarAgendamentoNoCliente(clienteId, servicos, dataAgendamento, valorTotal) {
  const clienteRef = doc(firestore, 'clientes', clienteId);
  const snapshot = await getDoc(clienteRef);
  if (!snapshot.exists()) {
    throw new Error('Cliente não encontrado para atualizar histórico.');
  }
  const clienteData = snapshot.data();
  const novosServicos = servicos.map(servico => ({
    servicoId: servico.id,
    servicoNome: servico.nome,
    data: dataAgendamento,
    valor: servico.valor
  }));

  await updateDoc(clienteRef, {
    servicosRealizados: [...(clienteData.servicosRealizados || []), ...novosServicos],
    datasAgendamentos: [...(clienteData.datasAgendamentos || []), dataAgendamento],
    totalVisitas: (clienteData.totalVisitas || 0) + 1,
    totalGasto: (clienteData.totalGasto || 0) + valorTotal,
    ultimaVisita: serverTimestamp()
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const salonId = getRequiredArg(args, '--salon-id', '--salon-id');
  const data = getRequiredArg(args, '--data', '--data');
  const quantidade = Number(args.get('--quantidade') || DEFAULTS.quantidade);
  const horaInicio = args.get('--hora-inicio') || DEFAULTS.horaInicio;
  const profissionalId = args.get('--profissional-id');
  const servicoIds = (args.get('--servicos') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const clientePrefixo = args.get('--cliente-prefixo') || DEFAULTS.clientePrefixo;
  const telefoneBase = normalizePhone(args.get('--telefone-base') || DEFAULTS.telefoneBase);
  const intervaloCustomizado = args.get('--intervalo');

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade precisa ser um número maior que zero.');
  }

  const salao = await carregarSalao(salonId);
  const profissional = await carregarProfissional(salonId, profissionalId);
  const servicos = await carregarServicos(salonId, servicoIds);

  const duracaoTotal = servicos.reduce((sum, servico) => sum + parseDuration(servico.duracao), 0);
  const valorTotal = servicos.reduce((sum, servico) => sum + Number(servico.valor || 0), 0);

  if (duracaoTotal <= 0) {
    throw new Error('Não foi possível calcular a duração total dos serviços.');
  }

  const intervaloAgendamento = intervaloCustomizado
    ? Number(intervaloCustomizado)
    : Number(salao?.configuracoes?.intervaloAgendamento || 0);

  const agendamentosExistentes = await carregarAgendamentosExistentes(
    salonId,
    profissional.id,
    data
  );

  const slots = buildScheduleSlots(agendamentosExistentes, duracaoTotal, intervaloAgendamento);
  let currentStart = timeToMinutes(horaInicio);

  console.log('Iniciando geração de agendamentos...');
  console.log(`Salão: ${salonId}`);
  console.log(`Profissional: ${profissional.nome} (${profissional.id})`);
  console.log(`Serviços: ${servicos.map(s => s.nome).join(', ')}`);
  console.log(`Data: ${data}`);
  console.log(`Quantidade: ${quantidade}`);
  console.log(`Intervalo entre agendamentos: ${intervaloAgendamento} min`);

  for (let i = 0; i < quantidade; i += 1) {
    currentStart = findNextAvailable(currentStart, slots, duracaoTotal, intervaloAgendamento);
    const horaInicioSlot = minutesToTime(currentStart);
    const horaFimSlot = minutesToTime(currentStart + duracaoTotal);

    const clienteNome = `${clientePrefixo} ${i + 1}`;
    const clienteTelefone = `${telefoneBase}${String(i + 1).padStart(2, '0')}`;

    const clienteId = await criarCliente({
      salonId,
      nome: clienteNome,
      telefone: clienteTelefone
    });

    const agendamento = {
      salonId,
      profissionalId: profissional.id,
      profissionalNome: profissional.nome,
      clienteId,
      clienteNome,
      clienteTelefone,
      servicos: servicos.map(servico => ({
        id: servico.id,
        nome: servico.nome,
        valor: servico.valor,
        duracao: servico.duracao
      })),
      data,
      horaInicio: horaInicioSlot,
      horaFim: horaFimSlot,
      status: 'pendente',
      valorTotal,
      duracaoTotal,
      createdAt: serverTimestamp()
    };

    const agendamentosRef = collection(firestore, 'agendamentos');
    await addDoc(agendamentosRef, agendamento);

    await registrarAgendamentoNoCliente(
      clienteId,
      servicos.map(servico => ({
        id: servico.id,
        nome: servico.nome,
        valor: servico.valor
      })),
      data,
      valorTotal
    );

    slots.push({
      inicio: currentStart,
      fim: currentStart + duracaoTotal
    });
    slots.sort((a, b) => a.inicio - b.inicio);

    console.log(`✓ Agendamento ${i + 1}/${quantidade} criado: ${horaInicioSlot} - ${horaFimSlot}`);

    currentStart += duracaoTotal + intervaloAgendamento;
  }

  console.log('Agendamentos criados com sucesso.');
}

main().catch(error => {
  console.error('Erro ao gerar agendamentos:', error.message || error);
  process.exit(1);
});
