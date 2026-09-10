'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useSystemSettings, useUpdateSystemSetting } from '../hooks/use-system-settings';
import { getSettingValue, parseSettingNumber, parseSettingString } from '../utils/settings-helpers';
import { Sparkles, Save, Loader2 } from 'lucide-react';
import { SystemSettingCategory } from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';

export function AiDefaultsTab() {
  const { data: settings, isLoading } = useSystemSettings(SystemSettingCategory.AI);
  const updateMutation = useUpdateSystemSetting();

  // Local form state initialized from query data
  const [provider, setProvider] = React.useState('GEMINI');
  const [model, setModel] = React.useState('gemini-2.5-flash');
  const [temperature, setTemperature] = React.useState('0.3');
  const [maxTokens, setMaxTokens] = React.useState('2048');
  const [isSaving, setIsSaving] = React.useState(false);

  // Sync state once remote settings load
  React.useEffect(() => {
    if (settings) {
      setProvider(
        parseSettingString(getSettingValue(settings, 'llm.default_provider', 'GEMINI'), 'GEMINI'),
      );
      setModel(
        parseSettingString(
          getSettingValue(settings, 'llm.default_model', 'gemini-2.5-flash'),
          'gemini-2.5-flash',
        ),
      );
      setTemperature(
        String(parseSettingNumber(getSettingValue(settings, 'llm.temperature_default', 0.3), 0.3)),
      );
      setMaxTokens(
        String(parseSettingNumber(getSettingValue(settings, 'llm.max_tokens_limit', 2048), 2048)),
      );
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const tempNum = Number(temperature);
      if (Number.isNaN(tempNum) || tempNum < 0 || tempNum > 1) {
        toast.error('Nhiệt độ (temperature) phải là số từ 0.0 đến 1.0');
        setIsSaving(false);
        return;
      }

      const tokensNum = Number(maxTokens);
      if (Number.isNaN(tokensNum) || tokensNum < 128 || tokensNum > 16384) {
        toast.error('Giới hạn tokens tối đa phải từ 128 đến 16384');
        setIsSaving(false);
        return;
      }

      await Promise.all([
        updateMutation.mutateAsync({
          key: 'llm.default_provider',
          payload: { value: provider },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'llm.default_model',
          payload: { value: model.trim() },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'llm.temperature_default',
          payload: { value: tempNum },
          silent: true,
        }),
        updateMutation.mutateAsync({
          key: 'llm.max_tokens_limit',
          payload: { value: tokensNum },
          silent: true,
        }),
      ]);
      toast.success('Cập nhật cấu hình AI thành công');
    } catch {
      // Error handled by mutation hook toast
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-6 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="gap-1 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Cấu hình Trí tuệ Nhân tạo & LLM Gateway
            </CardTitle>
            <CardDescription className="text-xs">
              Xác định nhà cung cấp AI mặc định, mô hình ngôn ngữ và các tham số sinh phản hồi cho
              Copilot bán hàng.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <FieldGroup>
            {/* LLM Provider */}
            <Field>
              <FieldLabel htmlFor="llm-provider">Nhà cung cấp LLM mặc định</FieldLabel>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="llm-provider" className="w-full">
                  <SelectValue placeholder="Chọn nhà cung cấp LLM" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GEMINI">Google Gemini (Khuyên dùng)</SelectItem>
                  <SelectItem value="OPENAI">OpenAI (GPT-4o)</SelectItem>
                  <SelectItem value="ANTHROPIC">Anthropic (Claude 3.5)</SelectItem>
                  <SelectItem value="DEEPSEEK">DeepSeek (DeepSeek V3 / R1)</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Cổng AI chính được sử dụng để điều hướng các tác vụ NER trích xuất địa chỉ và gợi ý
                kịch bản chat.
              </FieldDescription>
            </Field>

            {/* Model Name */}
            <Field>
              <FieldLabel htmlFor="llm-model">Tên mô hình mặc định (Model identifier)</FieldLabel>
              <Input
                id="llm-model"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="VD: gemini-2.5-flash, gpt-4o-mini"
              />
              <FieldDescription>
                Mã định danh mô hình chính xác theo tài liệu SDK chính thức của nhà cung cấp.
              </FieldDescription>
            </Field>

            {/* Temperature */}
            <Field>
              <FieldLabel htmlFor="llm-temperature">
                Nhiệt độ đàm phán bán hàng (Temperature: {temperature})
              </FieldLabel>
              <Input
                id="llm-temperature"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={temperature}
                onChange={e => setTemperature(e.target.value)}
              />
              <FieldDescription>
                Giá trị từ 0.0 (chính xác, nhất quán tuyệt đối) đến 1.0 (sáng tạo, linh hoạt).
                Khuyến nghị cho chốt đơn: 0.2 - 0.4.
              </FieldDescription>
            </Field>

            {/* Max Tokens */}
            <Field>
              <FieldLabel htmlFor="llm-tokens">
                Giới hạn Tokens phản hồi tối đa (Max Tokens)
              </FieldLabel>
              <Input
                id="llm-tokens"
                type="number"
                step="128"
                min="128"
                max="16384"
                value={maxTokens}
                onChange={e => setMaxTokens(e.target.value)}
              />
              <FieldDescription>
                Ngưỡng chặn số lượng token tối đa trong một lượt phản hồi của trợ lý AI để tránh
                lãng phí chi phí API.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSaving || updateMutation.isPending} className="gap-2">
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>Lưu Cấu hình AI</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
