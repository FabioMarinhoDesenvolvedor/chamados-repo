import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TicketAttachment, TicketStatus, isStaffRole } from '@chamados/shared';
import { useAuth } from '@/auth/auth-context';
import {
  useAddComment,
  useAssignTicket,
  useCloseTicket,
  useTicket,
  useUpdateStatus,
  useUploadAttachments,
} from '@/features/tickets/api';
import { StarRating } from '@/components/StarRating';
import {
  responseText,
  resolutionText,
  isResponded,
  responseBreached,
  resolutionBreached,
} from '@/lib/sla';
import { useUsers } from '@/features/users/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/StatusBadge';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Spinner } from '@/components/ui/spinner';
import { AttachmentGallery } from '@/components/AttachmentGallery';
import { AttachmentInput } from '@/components/AttachmentInput';
import { STATUS_LABEL, complexityLabel } from '@/lib/labels';

const DONE: TicketStatus[] = ['RESOLVED', 'CLOSED'];

type FeedItem =
  | { kind: 'status'; at: string; from: TicketStatus | null; to: TicketStatus }
  | { kind: 'comment'; at: string; author: string; body: string; attachments: TicketAttachment[] };

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // Staff (ADMIN/OPERATOR): atende o chamado (vê prioridade, muda status, assume, comenta).
  const isStaff = user ? isStaffRole(user.role) : false;
  const { data: ticket, isLoading } = useTicket(id);
  const updateStatus = useUpdateStatus(id);
  const assignTicket = useAssignTicket(id);
  const addComment = useAddComment(id);
  const uploadAttachments = useUploadAttachments();
  const { data: allUsers } = useUsers(isAdmin);
  const closeTicket = useCloseTicket(id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);

  if (isLoading) return <Spinner label="Carregando chamado..." />;
  if (!ticket) return <p className="text-gray-500">Chamado não encontrado.</p>;

  const response = responseText(ticket);
  const resolution = resolutionText(ticket);
  const responded = isResponded(ticket);
  const responseLate = responseBreached(ticket);
  const resolutionLate = resolutionBreached(ticket);

  // Possíveis responsáveis: equipe de atendimento (ADMIN ou OPERATOR).
  const staffUsers = allUsers?.filter((u) => isStaffRole(u.role)) ?? [];

  // Status manualmente selecionáveis (TRIAGE/OPEN são automáticos da triagem). Mantém os
  // dois estágios do encerramento: RESOLVED (aguarda confirmação) e CLOSED (admin encerra).
  const STAFF_STATUS_OPTIONS: TicketStatus[] = isAdmin
    ? ['IN_PROGRESS', 'RESOLVED', 'CLOSED']
    : ['IN_PROGRESS', 'RESOLVED'];
  const statusOptions = STAFF_STATUS_OPTIONS.includes(ticket.status)
    ? STAFF_STATUS_OPTIONS
    : [ticket.status, ...STAFF_STATUS_OPTIONS];

  const feed: FeedItem[] = [
    ...ticket.history.map((h) => ({
      kind: 'status' as const,
      at: h.createdAt,
      from: h.fromStatus,
      to: h.toStatus,
    })),
    ...ticket.comments.map((c) => ({
      kind: 'comment' as const,
      at: c.createdAt,
      author: c.author?.name ?? 'Usuário',
      body: c.body,
      attachments: c.attachments ?? [],
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  async function onAddComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const created = await addComment.mutateAsync({ body: comment });
    if (commentFiles.length > 0 && created?.id) {
      await uploadAttachments.mutateAsync({ ticketId: id, files: commentFiles, commentId: created.id });
    }
    setComment('');
    setCommentFiles([]);
  }

  const sendingComment = addComment.isPending || uploadAttachments.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-grena-dark">{ticket.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.subcategory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-grena/5 px-2 py-0.5 text-xs font-medium text-grena">
              <CategoryIcon
                name={ticket.detailOption?.icon ?? ticket.subcategory.icon}
                className="h-3.5 w-3.5"
              />
              {ticket.category?.name} › {ticket.subcategory.name}
              {ticket.detailOption ? ` › ${ticket.detailOption.name}` : ''}
            </span>
          )}
          {isStaff && (
            <span className="text-xs text-gray-500">
              Complexidade: {complexityLabel(ticket.complexity)}
            </span>
          )}
        </div>
        {response || resolution ? (
          isStaff ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className={responseLate ? 'font-medium text-red-600' : 'text-grena'}>
                ⏱ {responded ? 'Respondido' : response}
                {responseLate && ' — Resposta estourada'}
              </p>
              <p className={resolutionLate ? 'font-medium text-red-600' : 'text-grena'}>
                ⏱ {resolution}
                {resolutionLate && ' — Conclusão estourada'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              {response}
              {response && resolution ? ' · ' : ''}
              {resolution}
            </p>
          )
        ) : (
          <p className="mt-2 text-sm text-gray-500">Em análise — prazo definido após a triagem.</p>
        )}
      </div>

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold text-grena">Descrição</h3>
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {ticket.description || <span className="text-gray-400">Sem descrição complementar.</span>}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">Departamento</dt>
            <dd className="font-medium">{ticket.department?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Solicitante</dt>
            <dd className="font-medium">{ticket.requester?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Responsável</dt>
            <dd className="font-medium">{ticket.assignee?.name ?? 'Não atribuído'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Aberto em</dt>
            <dd className="font-medium">{new Date(ticket.createdAt).toLocaleString('pt-BR')}</dd>
          </div>
          {ticket.resolvedAt && (
            <div>
              <dt className="text-gray-500">Resolvido em</dt>
              <dd className="font-medium">{new Date(ticket.resolvedAt).toLocaleString('pt-BR')}</dd>
            </div>
          )}
        </dl>
        {ticket.attachments.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Imagens</h4>
            <AttachmentGallery attachments={ticket.attachments} />
          </div>
        )}
      </Card>

      {isStaff && (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold text-grena">Ações de atendimento</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Alterar status</Label>
              <Select
                value={ticket.status}
                onChange={(e) => updateStatus.mutate({ status: e.target.value as TicketStatus })}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                "Resolvido" aguarda a confirmação do solicitante; "Concluído" encerra o chamado.
              </p>
            </div>
            <div>
              <Label>Responsável</Label>
              {isAdmin ? (
                <Select
                  value={ticket.assignedTo ?? ''}
                  onChange={(e) => e.target.value && assignTicket.mutate({ assignedTo: e.target.value })}
                >
                  <option value="" disabled>
                    Selecione um responsável...
                  </option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              ) : ticket.assignedTo === user?.id ? (
                <p className="text-sm text-gray-600">Você é o responsável por este chamado.</p>
              ) : (
                // OPERATOR só pode assumir o chamado para si.
                <Button
                  variant="secondary"
                  className="w-full"
                  loading={assignTicket.isPending}
                  onClick={() => user && assignTicket.mutate({ assignedTo: user.id })}
                >
                  Assumir para mim
                </Button>
              )}
            </div>
            {/* Avaliação do solicitante é visível só ao ADMIN (business-rules). */}
            {isAdmin && ticket.status === 'CLOSED' && (
              <div className="sm:col-span-2">
                <Label>Avaliação do solicitante</Label>
                {ticket.rating ? (
                  <StarRating value={ticket.rating} readOnly />
                ) : (
                  <p className="text-sm text-gray-500">Sem avaliação.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {!isStaff && ticket.status === 'RESOLVED' && (
        <Card className="p-6">
          <h3 className="mb-1 text-sm font-semibold text-grena">Confirmar conclusão</h3>
          <p className="mb-4 text-sm text-gray-600">
            A TI marcou seu chamado como resolvido. Avalie o atendimento (opcional) e conclua.
          </p>
          <div className="mb-4">
            <Label>Sua avaliação</Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <Button
            loading={closeTicket.isPending}
            onClick={() => closeTicket.mutate({ rating: rating || undefined })}
          >
            {closeTicket.isPending ? 'Concluindo...' : 'Concluir chamado'}
          </Button>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-grena">Acompanhamento</h3>
        <ol className="space-y-4 border-l-2 border-grena/20 pl-4">
          {feed.map((item, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-grena" />
              <div className="text-xs text-gray-400">
                {new Date(item.at).toLocaleString('pt-BR')}
              </div>
              {item.kind === 'status' ? (
                <div className="text-sm text-gray-700">
                  {item.from ? `${STATUS_LABEL[item.from]} → ` : 'Criado: '}
                  <span className="font-medium">{STATUS_LABEL[item.to]}</span>
                </div>
              ) : (
                <div className="rounded-md bg-grena/5 p-3">
                  <div className="text-sm font-medium text-gray-800">{item.author}</div>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>
                  {item.attachments.length > 0 && (
                    <div className="mt-2">
                      <AttachmentGallery attachments={item.attachments} />
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>

        {DONE.includes(ticket.status) ? (
          <p className="mt-6 rounded-md bg-gray-50 p-3 text-sm text-gray-500">
            {ticket.status === 'RESOLVED'
              ? 'Chamado resolvido (aguardando confirmação). Comentários encerrados.'
              : 'Este chamado foi concluído. Comentários encerrados.'}
          </p>
        ) : (
          <form onSubmit={onAddComment} className="mt-6 space-y-2">
            <Textarea
              rows={3}
              placeholder="Escreva um comentário..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <AttachmentInput files={commentFiles} onChange={setCommentFiles} disabled={sendingComment} />
            <Button type="submit" loading={sendingComment} disabled={!comment.trim()}>
              {sendingComment ? 'Enviando...' : 'Comentar'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
