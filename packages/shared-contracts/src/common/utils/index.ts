import * as crypto from 'crypto';

export function generateId(prefix?: string): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function formatIsoDate(date: Date | string | number = new Date()): string {
  return new Date(date).toISOString();
}

export function isExpired(expiresAt: Date | string | number): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}
