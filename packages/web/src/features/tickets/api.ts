import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AddCommentInput,
  AssignTicketInput,
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
      (await api.patch(`/tickets/${id}`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTicketStatusInput) =>
      (await api.patch(`/tickets/${id}/status`, input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useAssignTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AssignTicketInput) =>
      (await api.patch(`/tickets/${id}/assign`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
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
  });
}
