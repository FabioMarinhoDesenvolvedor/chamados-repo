import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  url: string; // caminho do endpoint autenticado, ex.: /api/tickets/:id/attachments/:id
  alt: string;
}

// Busca a imagem com o token (Authorization) e a exibe via object URL.
// Necessário porque os anexos são cifrados e servidos só por endpoint autenticado.
export function AttachmentThumb({ url, alt }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    // baseURL '' porque a url já inclui o prefixo /api.
    api
      .get(url, { responseType: 'blob', baseURL: '' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data as Blob);
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-center text-[10px] text-gray-400">
        indisponível
      </div>
    );
  }
  if (!src) {
    return <div className="h-20 w-20 animate-pulse rounded-md border border-gray-200 bg-gray-100" />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      title={alt}
      className="block h-20 w-20 overflow-hidden rounded-md border border-gray-200 transition hover:ring-2 hover:ring-grena/40"
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </a>
  );
}
