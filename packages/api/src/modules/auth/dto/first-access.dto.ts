import { IsEmail, IsString, MinLength } from 'class-validator';

export class FirstAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
