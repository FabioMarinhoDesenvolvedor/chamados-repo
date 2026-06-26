import { IsString, MinLength } from 'class-validator';

export class UnlockVaultDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
