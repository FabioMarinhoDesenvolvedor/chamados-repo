import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddAttachmentsDto } from './dto/add-attachments.dto';
import { CloseTicketDto } from './dto/close-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { MAX_FILES, multerOptions } from './attachments.config';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.tickets.create(dto, user);
  }

  @Get()
  list(@Query() query: TicketQueryDto, @CurrentUser() user: AuthUser) {
    return this.tickets.list(query, user);
  }

  @Get('unread/count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.tickets.unreadCount(user);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.detail(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.updateStatus(id, dto.status, user);
  }

  @Patch(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.close(id, dto.rating, user);
  }

  @Patch(':id/assign')
  @Roles('ADMIN')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTicketDto) {
    return this.tickets.assign(id, dto.assignedTo);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addComment(id, dto.body, user);
  }

  @Post(':id/attachments')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, multerOptions))
  addAttachments(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: AddAttachmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addAttachments(id, files ?? [], dto.commentId, user);
  }

  @Get(':id/attachments/:attachmentId')
  async getAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.tickets.getAttachmentFile(id, attachmentId, user);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    // Impede o browser de "adivinhar" o tipo de um arquivo enviado por usuário.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.data);
  }
}
