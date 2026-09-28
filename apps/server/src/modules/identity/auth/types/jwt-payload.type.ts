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
  /** SHA-256 of the refresh token's secret half; verified (timing-safe) on rotation. */
  tokenSecretHash?: string;
  userId: string;
  familyId: string;
  email: string;
  role: PlatformRole;
  isRevoked: boolean;
  createdAt: number;
  expiresAt: number;
}
