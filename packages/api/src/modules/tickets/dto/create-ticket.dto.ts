import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsUUID()
  departmentId!: string;

  // Apenas ADMIN: abre o chamado em nome de outro usuário (solicitante).
  @IsOptional()
  @IsUUID()
  requesterId?: string;
}
