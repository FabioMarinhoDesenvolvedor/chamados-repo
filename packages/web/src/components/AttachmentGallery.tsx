import { TicketAttachment } from '@chamados/shared';
import { AttachmentThumb } from './AttachmentThumb';

interface Props {
  attachments: TicketAttachment[];
}

export function AttachmentGallery({ attachments }: Props) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((a) => (
        <AttachmentThumb key={a.id} url={a.url} alt={a.originalName} />
      ))}
    </div>
  );
}
