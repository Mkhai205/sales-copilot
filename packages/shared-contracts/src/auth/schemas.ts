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

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
  workspaceRole?: WorkspaceRole;
  avatarUrl?: string;
  workspaceId?: string;
  createdAt: string;
}

export interface LoginResponseDto {
  user: UserDto;
  tokens: AuthTokensDto;
}
