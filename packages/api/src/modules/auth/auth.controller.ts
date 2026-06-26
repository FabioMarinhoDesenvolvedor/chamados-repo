import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { FirstAccessDto } from './dto/first-access.dto';

@Controller('auth')
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
