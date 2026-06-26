import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  priorityWeight!: number;
}
