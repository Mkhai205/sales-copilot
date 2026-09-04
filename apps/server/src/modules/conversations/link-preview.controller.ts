import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LinkPreviewData, LinkPreviewService } from './link-preview.service';

@ApiTags('Conversations')
@Controller('conversations/link-preview')
@ApiBearerAuth()
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get OpenGraph link preview metadata for a URL' })
  @ApiResponse({ status: 200, description: 'Link preview metadata retrieved' })
  async getLinkPreview(@Query('url') url: string): Promise<LinkPreviewData> {
    return this.linkPreviewService.getPreview(url || '');
  }
}
