'use client';

import * as React from 'react';
import { Check, Clock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type {
  DaySchedule,
  InboxDetailDto,
  InboxWorkingHoursConfig,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateInbox } from '../hooks/use-inboxes';

interface TabBusinessHoursProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

interface DayOption {
  dayOfWeek: number;
  label: string;
}

const DAYS_OF_WEEK: DayOption[] = [
  { dayOfWeek: 1, label: 'Thứ hai' },
  { dayOfWeek: 2, label: 'Thứ ba' },
  { dayOfWeek: 3, label: 'Thứ tư' },
  { dayOfWeek: 4, label: 'Thứ năm' },
  { dayOfWeek: 5, label: 'Thứ sáu' },
  { dayOfWeek: 6, label: 'Thứ bảy' },
  { dayOfWeek: 0, label: 'Chủ nhật' },
];

const DEFAULT_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: 1, open: true, openTime: '08:30', closeTime: '18:00' },
  { dayOfWeek: 2, open: true, openTime: '08:30', closeTime: '18:00' },
  { dayOfWeek: 3, open: true, openTime: '08:30', closeTime: '18:00' },
  { dayOfWeek: 4, open: true, openTime: '08:30', closeTime: '18:00' },
  { dayOfWeek: 5, open: true, openTime: '08:30', closeTime: '18:00' },
  { dayOfWeek: 6, open: true, openTime: '08:30', closeTime: '12:00' },
  { dayOfWeek: 0, open: false, openTime: '08:30', closeTime: '18:00' },
];

export function TabBusinessHours({ inbox, workspaceId }: TabBusinessHoursProps) {
  const { mutate: updateInbox, isPending: isSaving } = useUpdateInbox(workspaceId);

  const existingWorkingHours = inbox.settings?.workingHours as InboxWorkingHoursConfig | undefined;

  const [enabled, setEnabled] = React.useState<boolean>(existingWorkingHours?.enabled ?? false);
  const [timezone, setTimezone] = React.useState<string>(
    existingWorkingHours?.timezone || 'Asia/Ho_Chi_Minh',
  );
  const normalizeSchedule = React.useCallback((existingList?: DaySchedule[]): DaySchedule[] => {
    return DAYS_OF_WEEK.map(d => {
      const found = existingList?.find(s => s.dayOfWeek === d.dayOfWeek);
      if (found) {
        return {
          dayOfWeek: d.dayOfWeek,
          open: Boolean(found.open),
          openTime: found.openTime || (found.open ? '08:30' : undefined),
          closeTime: found.closeTime || (found.open ? '18:00' : undefined),
        };
      }
      const defaultDay = DEFAULT_SCHEDULE.find(s => s.dayOfWeek === d.dayOfWeek);
      return (
        defaultDay || {
          dayOfWeek: d.dayOfWeek,
          open: false,
          openTime: '08:30',
          closeTime: '18:00',
        }
      );
    });
  }, []);

  const [schedule, setSchedule] = React.useState<DaySchedule[]>(() =>
    normalizeSchedule(existingWorkingHours?.schedule),
  );
  const [awayMessage, setAwayMessage] = React.useState<string>(
    existingWorkingHours?.awayMessage ||
      'Hiện tại chúng tôi đang ngoài giờ làm việc. Vui lòng để lại tin nhắn kèm Số điện thoại, chúng tôi sẽ phản hồi lại bạn ngay khi mở cửa trở lại!',
  );

  React.useEffect(() => {
    const wh = inbox.settings?.workingHours as InboxWorkingHoursConfig | undefined;
    setEnabled(wh?.enabled ?? false);
    setTimezone(wh?.timezone || 'Asia/Ho_Chi_Minh');
    if (wh?.schedule && wh.schedule.length > 0) {
      setSchedule(normalizeSchedule(wh.schedule));
    }
    if (wh?.awayMessage !== undefined) {
      setAwayMessage(wh.awayMessage);
    }
  }, [inbox, normalizeSchedule]);

  const handleToggleDayOpen = (dayOfWeek: number, open: boolean) => {
    setSchedule(prev => {
      const existing = prev.find(s => s.dayOfWeek === dayOfWeek);
      if (existing) {
        return prev.map(s =>
          s.dayOfWeek === dayOfWeek
            ? {
                ...s,
                open,
                openTime: s.openTime || '08:30',
                closeTime: s.closeTime || '18:00',
              }
            : s,
        );
      }
      return [...prev, { dayOfWeek, open, openTime: '08:30', closeTime: '18:00' }];
    });
  };

  const handleTimeChange = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setSchedule(prev => prev.map(s => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s)));
  };

  const handleApplyOfficePreset = () => {
    setSchedule(DEFAULT_SCHEDULE);
    toast.success('Đã áp dụng mẫu giờ hành chính tiêu chuẩn');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedSchedule = normalizeSchedule(schedule);

    if (enabled) {
      for (const day of normalizedSchedule) {
        if (day.open) {
          if (!day.openTime || !day.closeTime) {
            toast.error('Vui lòng nhập đầy đủ giờ mở cửa và đóng cửa cho các ngày đang mở');
            return;
          }
          if (day.openTime >= day.closeTime) {
            const dayLabel =
              DAYS_OF_WEEK.find(d => d.dayOfWeek === day.dayOfWeek)?.label ||
              `Thứ ${day.dayOfWeek}`;
            toast.error(
              `${dayLabel}: Giờ đóng cửa (${day.closeTime}) phải sau giờ mở cửa (${day.openTime})`,
            );
            return;
          }
        }
      }
    }

    const workingHours: InboxWorkingHoursConfig = {
      enabled,
      timezone,
      schedule: normalizedSchedule,
      awayMessage: awayMessage.trim(),
    };

    const updatedSettings = {
      ...(inbox.settings || {}),
      workingHours,
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        settings: updatedSettings,
      },
      successMessage: 'Cập nhật giờ làm việc thành công',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Card className="border-border bg-card/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Giờ làm việc & Tin nhắn vắng mặt
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Thiết lập lịch trực hỗ trợ hàng tuần và tin nhắn phản hồi tự động gửi cho khách hàng khi
            liên hệ ngoài giờ làm việc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-5">
            {/* Enable switch */}
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="text-xs font-medium text-foreground">
                  Kích hoạt chế độ Giờ làm việc cho hộp thư này
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Khi bật, nếu khách hàng nhắn tin vào thời điểm ngoài khung giờ làm việc đã thiết
                  lập, hệ thống sẽ tự động gửi tin nhắn vắng mặt.
                </span>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <FieldGroup className="gap-5 pt-1">
                {/* Timezone Select */}
                <Field>
                  <FieldLabel htmlFor="timezone-select" className="text-xs font-medium">
                    Múi giờ hoạt động (Timezone)
                  </FieldLabel>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone-select" className="h-9 text-xs max-w-sm">
                      <SelectValue placeholder="Chọn múi giờ" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="Asia/Ho_Chi_Minh" className="text-xs">
                        Asia/Ho_Chi_Minh (UTC+07:00 - Việt Nam)
                      </SelectItem>
                      <SelectItem value="Asia/Bangkok" className="text-xs">
                        Asia/Bangkok (UTC+07:00 - Thái Lan)
                      </SelectItem>
                      <SelectItem value="Asia/Singapore" className="text-xs">
                        Asia/Singapore (UTC+08:00 - Singapore)
                      </SelectItem>
                      <SelectItem value="Asia/Tokyo" className="text-xs">
                        Asia/Tokyo (UTC+09:00 - Nhật Bản)
                      </SelectItem>
                      <SelectItem value="UTC" className="text-xs">
                        UTC (Coordinated Universal Time)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* Schedule Table */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <FieldLabel className="text-xs font-medium">
                      Lịch trực các ngày trong tuần
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleApplyOfficePreset}
                      className="h-7 gap-1 text-[11px] text-primary hover:text-primary"
                    >
                      <Sparkles className="size-3" />
                      Áp dụng mẫu giờ hành chính (T2-T6, T7 sáng)
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-card/20 divide-y divide-border/60">
                    {DAYS_OF_WEEK.map(day => {
                      const dayConfig = schedule.find(s => s.dayOfWeek === day.dayOfWeek) || {
                        dayOfWeek: day.dayOfWeek,
                        open: false,
                        openTime: '08:30',
                        closeTime: '18:00',
                      };

                      return (
                        <div
                          key={day.dayOfWeek}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 text-xs"
                        >
                          <div className="flex items-center gap-3 w-32">
                            <Checkbox
                              id={`day-${day.dayOfWeek}`}
                              checked={dayConfig.open}
                              onCheckedChange={c => handleToggleDayOpen(day.dayOfWeek, Boolean(c))}
                            />
                            <label
                              htmlFor={`day-${day.dayOfWeek}`}
                              className="font-medium cursor-pointer select-none"
                            >
                              {day.label}
                            </label>
                          </div>

                          {dayConfig.open ? (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-[11px]">Từ:</span>
                              <Input
                                type="time"
                                value={dayConfig.openTime || '08:30'}
                                onChange={e =>
                                  handleTimeChange(day.dayOfWeek, 'openTime', e.target.value)
                                }
                                className="h-8 w-28 text-xs font-mono"
                              />
                              <span className="text-muted-foreground text-[11px]">Đến:</span>
                              <Input
                                type="time"
                                value={dayConfig.closeTime || '18:00'}
                                onChange={e =>
                                  handleTimeChange(day.dayOfWeek, 'closeTime', e.target.value)
                                }
                                className="h-8 w-28 text-xs font-mono"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal text-muted-foreground"
                              >
                                Đóng cửa / Không trực
                              </Badge>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Away Message */}
                <Field>
                  <FieldLabel htmlFor="away-message" className="text-xs font-medium">
                    Tin nhắn phản hồi tự động ngoài giờ làm việc (Away Message)
                  </FieldLabel>
                  <Textarea
                    id="away-message"
                    value={awayMessage}
                    onChange={e => setAwayMessage(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                    placeholder="Nhập nội dung tin nhắn sẽ tự động gửi khi khách hàng liên hệ ngoài giờ..."
                  />
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Tin nhắn này sẽ được gửi tối đa 1 lần cho mỗi phiên chat của khách hàng khi
                    ngoài giờ làm việc.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            )}

            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isSaving ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" data-icon="inline-start" />
                    Lưu cài đặt giờ làm việc
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
