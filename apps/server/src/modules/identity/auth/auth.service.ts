import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthTokensDto,
  ChangePasswordDto,
  ChangePasswordResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterResponseDto,
  UpdateUserProfileDto,
  UserDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { generateSlug } from '../workspaces/utils/slug.util';
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
   * Registers a new user and provisions their default workspace atomically (TASK-3A-05).
   * Creates User + Workspace + Member (OWNER) + Primary Inbox in a single transaction.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email address already exists',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const workspaceName = dto.workspaceName?.trim() || `${dto.name.trim()}'s Workspace`;

    const result = await this.prisma.runInTransaction(async _txCtx => {
      const client = this.prisma.client;

      const user = await client.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: dto.name.trim(),
          role: 'USER',
          isActive: true,
        },
      });

      let candidateSlug = generateSlug(workspaceName);
      const existingSlug = await client.workspace.findUnique({
        where: { slug: candidateSlug },
      });
      if (existingSlug) {
        candidateSlug = `${candidateSlug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const workspace = await client.workspace.create({
        data: {
          name: workspaceName,
          slug: candidateSlug,
          billingPlan: 'FREE',
          timezone: 'Asia/Ho_Chi_Minh',
          defaultLanguage: 'vi',
        },
      });

      await client.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      const inbox = await client.inbox.create({
        data: {
          workspaceId: workspace.id,
          name: 'Hộp thư chính',
        },
      });

      await client.inboxMember.create({
        data: {
          inboxId: inbox.id,
          userId: user.id,
        },
      });

      return { user, workspace };
    });

    const tokens = await this.tokenService.generateTokens({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    this.logger.log(
      `Registered user '${result.user.email}' (${result.user.id}) with default workspace '${result.workspace.name}' (${result.workspace.id})`,
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        avatarUrl: result.user.avatarUrl,
        isActive: result.user.isActive,
        createdAt: result.user.createdAt.toISOString(),
        updatedAt: result.user.updatedAt.toISOString(),
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
        billingPlan: result.workspace.billingPlan,
        timezone: result.workspace.timezone,
        defaultLanguage: result.workspace.defaultLanguage,
        settings: (result.workspace.settings as Record<string, unknown>) || null,
        createdAt: result.workspace.createdAt.toISOString(),
        updatedAt: result.workspace.updatedAt.toISOString(),
      },
      tokens,
    };
  }

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

  /**
   * Changes authenticated user password with current password verification.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<ChangePasswordResponseDto> {
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

    const isMatch = await this.passwordService.verify(user.passwordHash, dto.currentPassword);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      });
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all existing refresh token sessions for security
    await this.tokenService.revokeAllUserTokens(userId);

    this.logger.log(`Password changed successfully for user '${userId}'`);

    return {
      success: true,
      message: 'Đổi mật khẩu thành công',
    };
  }
}
