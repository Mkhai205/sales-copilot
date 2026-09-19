import { z } from 'zod';
import { PlatformRole, WorkspaceRole } from './enums';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type LogoutDto = z.infer<typeof logoutSchema>;

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  workspaceRole?: WorkspaceRole;
  avatarUrl?: string | null;
  workspaceId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginResponseDto {
  user: UserDto;
  tokens: AuthTokensDto;
}

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  workspaceName: z.string().min(1).max(100).optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export interface RegisterResponseDto {
  user: UserDto;
  workspace: {
    id: string;
    name: string;
    slug: string;
    billingPlan: string;
    timezone: string;
    defaultLanguage: string;
    settings?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt?: string;
  };
  tokens: AuthTokensDto;
}
