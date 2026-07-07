import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class AddAttachmentsDto {
  // Quando presente, vincula os anexos a um comentario do chamado.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  commentId?: number;
}
