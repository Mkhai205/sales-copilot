import { Controller, Get, HttpCode, HttpStatus, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  PlatformRole,
  querySystemSettingsSchema,
  QuerySystemSettingsDto,
  SystemSettingItemDto,
  updateSystemSettingSchema,
  UpdateSystemSettingDto,
} from '@sales-copilot/shared-contracts';
import type { Request } from 'express';
import { ZodBody, ZodQuery } from '../../../common/pipes';
import { CurrentUser } from '../../auth';
import type { JwtUserPayload } from '../../auth';
import { PlatformRoles } from '../decorators/platform-roles.decorator';
import { PlatformRolesGuard } from '../guards/platform-roles.guard';
import { SystemSettingsService } from '../services/system-settings.service';

@ApiTags('Platform Admin Settings')
@Controller('platform-admin/settings')
@UseGuards(PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all platform system settings or filter by category',
  })
  @ApiResponse({ status: 200, description: 'System settings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  async list(
    @ZodQuery(querySystemSettingsSchema) query?: QuerySystemSettingsDto,
  ): Promise<SystemSettingItemDto[]> {
    return this.systemSettingsService.getAllSettings(query?.category);
  }

  @Put(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a platform dynamic system setting value atomically',
  })
  @ApiResponse({ status: 200, description: 'System setting updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Super Administrator role required' })
  async update(
    @Param('key') key: string,
    @ZodBody(updateSystemSettingSchema) dto: UpdateSystemSettingDto,
    @CurrentUser() user: JwtUserPayload,
    @Req() req: Request,
  ): Promise<SystemSettingItemDto> {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] as string | undefined;

    return this.systemSettingsService.updateSetting(key, dto, {
      userId: user.userId,
      email: user.email,
      ipAddress,
      userAgent,
    });
  }
}
