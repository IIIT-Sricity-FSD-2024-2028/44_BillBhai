import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User username',
    example: 'admin1',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'User password',
    example: 'Admin@123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
