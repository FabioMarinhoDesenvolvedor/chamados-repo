import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLES, Role, TEMP_PASSWORD_MIN_LENGTH } from '@chamados/shared';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(TEMP_PASSWORD_MIN_LENGTH)
  password!: string;

  @IsIn(ROLES)
  role!: Role;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;
}
