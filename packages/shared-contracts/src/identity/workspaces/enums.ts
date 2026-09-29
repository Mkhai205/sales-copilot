export const BillingPlanType = {
  FREE: 'FREE',
  STANDARD: 'STANDARD',
  ENTERPRISE: 'ENTERPRISE',
} as const;

export type BillingPlanType = (typeof BillingPlanType)[keyof typeof BillingPlanType];
