import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AddCommentInput,
  AssignTicketInput,
  CloseTicketInput,
  CreateTicketInput,
  Ticket,
  TicketAttachment,
  TicketDetail,
  TicketFilters,
  UnreadCount,
  UpdateTicketInput,
  UpdateTicketStatusInput,
} from '@chamados/shared';
import { api } from '@/lib/api';

export function useTickets(filters: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => (await api.get<Ticket[]>('/tickets', { params: filters })).data,
  });
}

export function useTicket(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const data = (await api.get<TicketDetail>(`/tickets/${id}`)).data;
      // Abrir o detalhe marca como visto no backend; atualiza badge e lista.
      qc.invalidateQueries({ queryKey: ['unread-count'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => (await api.get<UnreadCount>('/tickets/unread/count')).data,
    refetchInterval: 20000,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTicketInput) =>
      (await api.post<Ticket>('/tickets', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
    meta: { successMessage: 'Chamado aberto' },
  });
}

export function useUploadAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ticketId,
      files,
      commentId,
    }: {
      ticketId: string;
      files: File[];
      commentId?: string;
    }) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      if (commentId) form.append('commentId', commentId);
      return (await api.post<TicketAttachment[]>(`/tickets/${ticketId}/attachments`, form)).data;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['ticket', vars.ticketId] }),
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTicketInput) =>
      (await api.patch<Ticket>(`/tickets/${id}`, input)).data,
    onSuccess: (updated) => {
      // Aplica a resposta já projetada no cache do detalhe na hora: o badge de prioridade
      // reflete o novo valor imediatamente, sem depender do timing do refetch.
      qc.setQueryData<TicketDetail>(['ticket', id], (old) => (old ? { ...old, ...updated } : old));
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    meta: { successMessage: 'Chamado atualizado' },
  });
}

export function useUpdateStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTicketStatusInput) =>
      (await api.patch<Ticket>(`/tickets/${id}/status`, input)).data,
    onSuccess: (updated) => {
      // Reflete status/SLA no detalhe imediatamente, sem esperar o refetch.
      qc.setQueryData<TicketDetail>(['ticket', id], (old) => (old ? { ...old, ...updated } : old));
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
    meta: { successMessage: 'Status atualizado' },
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignTicketInput) =>
      (await api.patch<Ticket>(`/tickets/${id}/assign`, input)).data,
    onSuccess: (updated) => {
      // Reflete o novo responsável na hora: na lista do dashboard e no detalhe (sem esperar
      // o refetch — antes só atualizava ao sair e voltar da página).
      qc.setQueriesData<Ticket[]>({ queryKey: ['tickets'] }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      );
      qc.setQueryData<TicketDetail>(['ticket', id], (old) => (old ? { ...old, ...updated } : old));
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    meta: { successMessage: 'Responsável definido' },
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddCommentInput) =>
      (await api.post(`/tickets/${id}/comments`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
    meta: { successMessage: 'Comentário enviado' },
  });
}

export function useCloseTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseTicketInput) =>
      (await api.patch(`/tickets/${id}/close`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
    meta: { successMessage: 'Chamado concluído' },
  });
}
