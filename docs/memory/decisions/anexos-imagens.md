# Anexos de imagem em chamados

Data: 2026-06-26

## Contexto
Usuário precisa anexar imagens/prints ao abrir um chamado e ao comentar, para a TI ver o problema.

## Decisão
- **Armazenamento: disco + tabela de metadados** (escolha do Fabio). Arquivo físico em
  `packages/api/uploads/<uuid>.<ext>` (nome aleatório, não adivinhável); metadados na tabela
  `ticket_attachments`. Postgres fica leve. (Alternativa descartada: bytea no banco.)
- **Servir**: arquivos estáticos via `app.useStaticAssets(UPLOADS_DIR, { prefix: '/api/uploads/' })`
  no `main.ts` (NestExpressApplication). URL pública = `/api/uploads/<filename>`. Sem auth no GET:
  a aleatoriedade do nome é a capability (aceitável no MVP interno).
- **Upload**: `POST /tickets/:id/attachments` (multipart, campo `files`, Multer diskStorage).
  `commentId` opcional no form vincula o anexo a um comentário. Só imagens (png/jpeg/gif/webp),
  máx 5 MB, até 5 arquivos. Config em `modules/tickets/attachments.config.ts`.
- **Escopo**: anexar na **abertura** do chamado e em **comentários**. Fluxo no front: cria o
  recurso (chamado/comentário em JSON) e só então sobe os anexos para o id retornado.

## Consequências
- Deploy precisa de **volume persistente** montado em `packages/api/uploads` (senão os arquivos
  somem em redeploy). Backup do banco não inclui os binários — backupar a pasta também.
- `uploads/.gitignore` ignora os binários (mantém a pasta versionada).
- DTO/tipos: `TicketAttachment` no shared; `TicketDetail.attachments` (nível chamado) e
  `TicketComment.attachments` (por comentário). Service troca `filename` por `url`.
