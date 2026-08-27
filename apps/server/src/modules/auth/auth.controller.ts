import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type AuthTokensDto,
  type LoginDto,
  type LoginResponseDto,
  loginSchema,
  type LogoutDto,
  logoutSchema,
  type RefreshTokenDto,
  refreshTokenSchema,
  type UserDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';
import { JwtAuthGuard } from './guards';
import { JwtUserPayload } from './types/jwt-payload.type';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 403, description: 'Account deactivated' })
  @ApiResponse({ status: 429, description: 'Too many login attempts. Please try again later.' })
  async login(@ZodBody(loginSchema) dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  @ApiResponse({ status: 403, description: 'Account deactivated' })
  async refresh(@ZodBody(refreshTokenSchema) dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke active refresh token / session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(logoutSchema) dto: LogoutDto,
  ): Promise<{ loggedOut: boolean }> {
    return this.authService.logout(user.userId, dto.refreshToken);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: JwtUserPayload): Promise<UserDto> {
    return this.authService.getProfile(user.userId);
  }
}
