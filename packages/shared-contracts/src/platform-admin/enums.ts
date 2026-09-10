export const PlatformAuditAction = {
  WORKSPACE_SUSPENDED: 'WORKSPACE_SUSPENDED',
  WORKSPACE_ACTIVATED: 'WORKSPACE_ACTIVATED',
  QUOTA_UPDATED: 'QUOTA_UPDATED',
  PLAN_CHANGED: 'PLAN_CHANGED',
  SYSTEM_SETTING_UPDATED: 'SYSTEM_SETTING_UPDATED',
} as const;
export type PlatformAuditAction = (typeof PlatformAuditAction)[keyof typeof PlatformAuditAction];

export const PlatformAuditTargetType = {
  WORKSPACE: 'WORKSPACE',
  SYSTEM_SETTING: 'SYSTEM_SETTING',
  USER: 'USER',
} as const;
export type PlatformAuditTargetType =
  (typeof PlatformAuditTargetType)[keyof typeof PlatformAuditTargetType];

export const SystemSettingCategory = {
  GENERAL: 'GENERAL',
  FEATURE_FLAGS: 'FEATURE_FLAGS',
  AI: 'AI',
  BILLING: 'BILLING',
  SYSTEM: 'SYSTEM',
} as const;
export type SystemSettingCategory =
  (typeof SystemSettingCategory)[keyof typeof SystemSettingCategory];
