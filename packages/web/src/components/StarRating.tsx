import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, readOnly = false }: StarRatingProps) {
  if (readOnly) {
    return (
      <div
        role="img"
        aria-label={`Avaliação: ${value} de 5 estrelas`}
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-6 w-6 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onChange?.(n)}
          className="min-h-[44px] min-w-[44px] cursor-pointer"
        >
          <Star
            className={`h-6 w-6 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  );
}
