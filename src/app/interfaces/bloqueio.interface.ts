export interface BloqueioHorario {
  id?: string;
  salonId: string;
  aplicaParaTodos: boolean;
  profissionalId?: string | null;
  profissionalNome?: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  motivo?: string;
  createdAt?: any;
}
