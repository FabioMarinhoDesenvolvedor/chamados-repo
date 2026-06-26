import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ROLES, Role } from '@chamados/shared';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(ROLES)
  role!: Role;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
