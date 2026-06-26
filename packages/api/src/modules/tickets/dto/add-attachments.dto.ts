import { IsOptional, IsUUID } from 'class-validator';

export class AddAttachmentsDto {
  // Quando presente, vincula os anexos a um comentário do chamado.
  @IsOptional()
  @IsUUID()
  commentId?: string;
}
