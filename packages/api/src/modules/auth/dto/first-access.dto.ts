import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH, PASSWORD_RULE_MESSAGE, STRONG_PASSWORD_REGEX } from '@chamados/shared';

export class FirstAccessDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(STRONG_PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}
