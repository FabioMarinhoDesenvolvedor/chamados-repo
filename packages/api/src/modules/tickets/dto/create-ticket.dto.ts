import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  // Categorizacao guiada (entrada principal, substitui o titulo livre).
  @Type(() => Number)
  @IsInt()
  categoryId!: number;

  @Type(() => Number)
  @IsInt()
  subcategoryId!: number;

  // 3o nivel ("detalhe") - obrigatorio quando a subcategoria escolhida tiver detalhes.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  detailOptionId?: number;

  // Descricao complementar opcional (detalhes dentro da subcategoria).
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  departmentId!: number;

  // Apenas ADMIN: abre o chamado em nome de outro usuario (solicitante).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requesterId?: number;

  // Local/sala de origem — obrigatorio quando o solicitante e kiosk (totem);
  // ignorado (gravado como null) para usuarios comuns.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originLocation?: string;
}
