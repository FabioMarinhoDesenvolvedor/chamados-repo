import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { VaultService } from './vault.service';
import { UnlockVaultDto } from './dto/unlock-vault.dto';

@Controller('vault')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  // Status pode ser lido por qualquer autenticado (para a UI mostrar o aviso).
  @Get('status')
  status() {
    return { status: this.vault.getStatus() };
  }

  @Post('unlock')
  @HttpCode(200)
  @Roles('ADMIN')
  unlock(@Body() dto: UnlockVaultDto) {
    return { status: this.vault.unlock(dto.password) };
  }

  @Post('lock')
  @HttpCode(200)
  @Roles('ADMIN')
  lock() {
    this.vault.lock();
    return { status: this.vault.getStatus() };
  }
}
