import { PlatformRole } from '@sales-copilot/shared-contracts';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: PlatformRole;
  iat?: number;
  exp?: number;
}

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: PlatformRole;
}

export interface StoredRefreshToken {
  tokenId: string;
  userId: string;
  familyId: string;
  email: string;
  role: PlatformRole;
  isRevoked: boolean;
  createdAt: number;
  expiresAt: number;
}
