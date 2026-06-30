import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
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

  // Aceita string (UUID) ou null para remover do departamento.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  departmentId?: string | null;
}
