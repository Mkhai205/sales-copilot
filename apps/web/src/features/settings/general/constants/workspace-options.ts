export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface TimezoneGroup {
  group: string;
  options: SelectOption[];
}

export const TIMEZONE_OPTIONS: TimezoneGroup[] = [
  {
    group: 'Asia & Pacific',
    options: [
      { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+07:00)' },
      { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+07:00)' },
      { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+08:00)' },
      { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+09:00)' },
      { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (UTC+08:00)' },
      { value: 'Asia/Seoul', label: 'Asia/Seoul (UTC+09:00)' },
      { value: 'Asia/Jakarta', label: 'Asia/Jakarta (UTC+07:00)' },
      { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+04:00)' },
      { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+10:00)' },
      { value: 'Pacific/Auckland', label: 'Pacific/Auckland (UTC+12:00)' },
    ],
  },
  {
    group: 'Europe & Africa',
    options: [
      { value: 'UTC', label: 'UTC (UTC+00:00)' },
      { value: 'Europe/London', label: 'Europe/London (UTC+00:00)' },
      { value: 'Europe/Paris', label: 'Europe/Paris (UTC+01:00)' },
      { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+01:00)' },
      { value: 'Europe/Helsinki', label: 'Europe/Helsinki (UTC+02:00)' },
      { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+02:00)' },
      { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (UTC+02:00)' },
    ],
  },
  {
    group: 'Americas',
    options: [
      { value: 'America/New_York', label: 'America/New_York (UTC-05:00 / Eastern)' },
      { value: 'America/Chicago', label: 'America/Chicago (UTC-06:00 / Central)' },
      { value: 'America/Denver', label: 'America/Denver (UTC-07:00 / Mountain)' },
      { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-08:00 / Pacific)' },
      { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (UTC-03:00)' },
      { value: 'America/Toronto', label: 'America/Toronto (UTC-05:00)' },
    ],
  },
];

export const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'en', label: 'English (US)' },
  { value: 'vi', label: 'Tiếng Việt (Vietnamese)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'fr', label: 'Français (French)' },
  { value: 'de', label: 'Deutsch (German)' },
  { value: 'es', label: 'Español (Spanish)' },
];

/**
 * Helper to get human-readable timezone label
 */
export function getTimezoneLabel(value?: string | null): string {
  if (!value) return 'UTC (UTC+00:00)';
  for (const group of TIMEZONE_OPTIONS) {
    const found = group.options.find(opt => opt.value === value);
    if (found) return found.label;
  }
  return value;
}

/**
 * Helper to get human-readable language label
 */
export function getLanguageLabel(value?: string | null): string {
  if (!value) return 'English (US)';
  const found = LANGUAGE_OPTIONS.find(opt => opt.value === value);
  return found ? found.label : value;
}
