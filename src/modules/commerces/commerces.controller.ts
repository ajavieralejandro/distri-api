import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user';
import { CurrentUser } from '../../shared/auth/current-user.decorator';
import { Roles } from '../../shared/auth/roles.decorator';
import { CommercesService } from './commerces.service';
import { ListCommercesQueryDto } from './dto/list-commerces-query.dto';

@ApiTags('commerces')
@ApiBearerAuth()
@Controller('commerces')
export class CommercesController {
  constructor(private readonly commercesService: CommercesService) {}

  @Get()
  @Roles(Role.ADMIN)
  list(@Query() query: ListCommercesQueryDto) {
    return this.commercesService.list({
      page: query.page ?? 0,
      size: query.size ?? 20,
      search: query.search,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COMMERCE)
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.commercesService.getById(user, id);
  }
}
