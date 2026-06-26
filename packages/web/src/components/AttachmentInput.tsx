import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/cn';

const MAX_FILES = 5;

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function AttachmentInput({ files, onChange, disabled }: Props) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [pastedFlash, setPastedFlash] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Ref com os arquivos atuais p/ os listeners (paste/drop) não usarem valor "velho".
  const filesRef = useRef(files);
  filesRef.current = files;

  // Fonte única: filtra imagens e respeita o limite. Usada por escolher/colar/arrastar.
  function addFiles(incoming: File[]): boolean {
    if (disabled) return false;
    const images = incoming.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return false;
    onChange([...filesRef.current, ...images].slice(0, MAX_FILES));
    return true;
  }

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Colar print da área de transferência (Ctrl+V) anexa direto como imagem.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled) return;
      const images = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f != null);
      if (images.length === 0) return; // colar texto não é afetado
      e.preventDefault();
      onChange([...filesRef.current, ...images].slice(0, MAX_FILES));
      setPastedFlash(true);
      window.setTimeout(() => setPastedFlash(false), 1500);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [disabled, onChange]);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  }

  function onDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function remove(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  const atLimit = files.length >= MAX_FILES;

  return (
    <div className="space-y-2">
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-grena/40 px-3 py-3 text-center text-sm font-medium text-grena transition hover:bg-grena/5',
          dragOver && 'border-grena bg-grena/10',
          (disabled || atLimit) && 'pointer-events-none opacity-50',
        )}
      >
        <ImagePlus className="h-5 w-5" />
        <span>{dragOver ? 'Solte as imagens aqui' : 'Anexar imagens — clique, arraste ou cole'}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
          disabled={disabled}
        />
      </label>
      {pastedFlash && (
        <span className="ml-1 align-middle text-xs font-medium text-green-600">
          Print colado!
        </span>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border border-gray-200">
              <img src={src} alt={files[i]?.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remover imagem"
                className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Clique, arraste ou cole com <kbd className="rounded bg-gray-100 px-1">Ctrl</kbd>+
        <kbd className="rounded bg-gray-100 px-1">V</kbd>. Até {MAX_FILES} imagens, 5 MB cada (PNG, JPG, GIF, WEBP).
      </p>
    </div>
  );
}
