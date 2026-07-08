import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKioskTokenDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;

  @Type(() => Number)
  @IsInt()
  departmentId!: number;
}
