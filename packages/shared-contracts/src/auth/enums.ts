export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  USER = 'USER',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export type UserRole = PlatformRole | WorkspaceRole;
export const UserRole = { ...PlatformRole, ...WorkspaceRole };
