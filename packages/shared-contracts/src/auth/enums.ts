export const PlatformRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  USER: 'USER',
} as const;
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];

export const WorkspaceRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  VIEWER: 'VIEWER',
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export type UserRole = PlatformRole | WorkspaceRole;
export const UserRole = { ...PlatformRole, ...WorkspaceRole } as const;
