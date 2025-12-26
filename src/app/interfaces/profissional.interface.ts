export interface Profissional {
  id?: string;
  salonId: string;
  nome: string;
  foto: string;
  descricao: string;
  interesses: string[];
  ativo: boolean;
  ordem: number;
  createdAt?: any;
  updatedAt?: any;
}
