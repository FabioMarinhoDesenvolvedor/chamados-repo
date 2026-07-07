import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ROLES, Role, TEMP_PASSWORD_MIN_LENGTH } from '@chamados/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(TEMP_PASSWORD_MIN_LENGTH)
  password?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  // Aceita number ou null para remover do departamento.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  departmentId?: number | null;
}
