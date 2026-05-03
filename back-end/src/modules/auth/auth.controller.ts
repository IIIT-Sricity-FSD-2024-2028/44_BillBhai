import {
  Controller,
  Post,
  Body,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
@ApiTags('Auth')
@ApiSecurity('x-role')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({
    type: LoginDto,
    examples: {
      admin: {
        value: {
          username: 'admin',
          password: 'admin123',
        },
      },
      cashier: {
        value: {
          username: 'cashier',
          password: 'cashier123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    example: {
      id: 'USR-001',
      username: 'admin',
      role: 'admin',
      email: 'admin@freshkart.com',
      companyId: 'BIZ-101',
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    try {
      return this.authService.validateCredentials(dto.username, dto.password);
    } catch {
      throw new UnauthorizedException('Invalid username or password');
    }
  }
}
