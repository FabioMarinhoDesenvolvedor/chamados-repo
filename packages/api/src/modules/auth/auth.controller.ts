import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { FirstAccessDto } from './dto/first-access.dto';

// Rate limit (10/min por IP) só nas rotas de autenticação, contra brute-force.
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('first-access')
  @HttpCode(200)
  firstAccess(@Body() dto: FirstAccessDto) {
    return this.auth.firstAccess(dto.email, dto.newPassword);
  }
}
