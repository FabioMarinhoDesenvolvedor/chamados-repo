import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  @Roles('ADMIN')
  list() {
    return { directory: this.backup.directory(), items: this.backup.list() };
  }

  @Post('run')
  @HttpCode(200)
  @Roles('ADMIN')
  run() {
    return this.backup.runBackup();
  }
}
