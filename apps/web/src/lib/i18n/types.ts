import type { TranslationSchema } from './locales/vi';

type Prev = [never, 0, 1, 2, 3, 4];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

type Leaves<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends object
    ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
    : '';

export type TranslationKey = Leaves<TranslationSchema>;

export type TranslationParams = Record<string, string | number>;
