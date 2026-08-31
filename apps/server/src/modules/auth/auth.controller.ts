import { Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
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
  type UpdateUserProfileDto,
  updateUserProfileSchema,
  type UserDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../common/pipes';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { JwtUserPayload } from './types/jwt-payload.type';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
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

  @Public()
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: JwtUserPayload): Promise<UserDto> {
    return this.authService.getProfile(user.userId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(updateUserProfileSchema) dto: UpdateUserProfileDto,
  ): Promise<UserDto> {
    return this.authService.updateProfile(user.userId, dto);
  }
}
