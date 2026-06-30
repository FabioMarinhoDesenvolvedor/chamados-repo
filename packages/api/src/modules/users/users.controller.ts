import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MustChangePasswordGuard } from '../../common/guards/must-change-password.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipPasswordChangeCheck } from '../../common/decorators/skip-password-change-check.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @SkipPasswordChangeCheck()
  me(@CurrentUser() user: AuthUser) {
    return this.users.findOnePublic(user.userId);
  }

  @Post('me/password')
  @SkipPasswordChangeCheck()
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Get()
  @Roles('ADMIN')
  list() {
    return this.users.list();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.users.remove(id, user);
  }
}
