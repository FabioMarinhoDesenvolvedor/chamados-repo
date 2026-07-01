import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  // Categorização guiada (entrada principal, substitui o título livre).
  @IsUUID()
  categoryId!: string;

  @IsUUID()
  subcategoryId!: string;

  // 3º nível ("detalhe") — obrigatório quando a subcategoria escolhida tiver detalhes.
  @IsOptional()
  @IsUUID()
  detailOptionId?: string;

  // Descrição complementar opcional (detalhes dentro da subcategoria).
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description?: string;

  @IsUUID()
  departmentId!: string;

  // Apenas ADMIN: abre o chamado em nome de outro usuário (solicitante).
  @IsOptional()
  @IsUUID()
  requesterId?: string;
}
