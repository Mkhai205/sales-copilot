import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthTokensDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  UpdateUserProfileDto,
  UserDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Authenticates a user with email and password.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.client.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    const isPasswordValid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const tokens = await this.tokenService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return {
      user: userDto,
      tokens,
    };
  }

  /**
   * Refreshes access and refresh tokens via Token Rotation.
   */
  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokensDto> {
    const { tokens, userId } = await this.tokenService.rotateRefreshToken(dto.refreshToken);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      // If user was deactivated after token generation, revoke active sessions
      await this.tokenService.revokeAllUserTokens(userId);
      throw new ForbiddenException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    return tokens;
  }

  /**
   * Logs out user by revoking refresh token session.
   */
  async logout(userId?: string, refreshToken?: string): Promise<{ loggedOut: boolean }> {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    } else if (userId) {
      await this.tokenService.revokeAllUserTokens(userId);
    }

    return { loggedOut: true };
  }

  /**
   * Retrieves profile details for the authenticated user.
   */
  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Account is deactivated',
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * Updates profile details (name, avatarUrl) for the authenticated user.
   */
  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<UserDto> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Account is deactivated',
      });
    }

    const updated = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    this.logger.log(`Updated user profile for '${userId}'`);

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
