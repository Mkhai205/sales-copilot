'use client';

import * as React from 'react';
import { Users, CheckCircle2, ArrowLeft, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useNewInbox } from '../context/new-inbox-context';

export function CollaboratorPickerStep() {
  const {
    selectedChannel,
    selectedChannelKey,
    pendingFbPageIds,
    workspaceMembers,
    isLoadingMembers,
    selectedMemberUserIds,
    setSelectedMemberUserIds,
    isSubmitting,
    goToStage,
    completeCreation,
  } = useNewInbox();

  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredMembers = React.useMemo(() => {
    if (!workspaceMembers) return [];
    if (!searchQuery.trim()) return workspaceMembers;
    const q = searchQuery.toLowerCase().trim();
    return workspaceMembers.filter(m => {
      const name = m.user?.name?.toLowerCase() || '';
      const email = m.user?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
  }, [workspaceMembers, searchQuery]);

  const totalMembersCount = workspaceMembers?.length || 0;
  const isSearchActive = Boolean(searchQuery.trim());
  const targetMembers = isSearchActive ? filteredMembers : workspaceMembers || [];
  const targetIds = React.useMemo(() => targetMembers.map(m => m.userId), [targetMembers]);

  const selectedTargetCount = React.useMemo(
    () => targetIds.filter(id => selectedMemberUserIds.includes(id)).length,
    [targetIds, selectedMemberUserIds],
  );

  const isAllTargetSelected = targetIds.length > 0 && selectedTargetCount === targetIds.length;
  const isTargetIndeterminate =
    targetIds.length > 0 && selectedTargetCount > 0 && selectedTargetCount < targetIds.length;

  const checkboxCheckedState: boolean | 'indeterminate' = isTargetIndeterminate
    ? 'indeterminate'
    : isAllTargetSelected;

  const handleToggleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true || isTargetIndeterminate) {
      setSelectedMemberUserIds(prev => Array.from(new Set([...prev, ...targetIds])));
    } else {
      setSelectedMemberUserIds(prev => prev.filter(id => !targetIds.includes(id)));
    }
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  const isFacebookMulti = selectedChannelKey === 'facebook' && pendingFbPageIds.length > 1;

  const submitButtonText = isFacebookMulti
    ? `Hoàn tất & Kết nối ${pendingFbPageIds.length} Fanpage`
    : 'Hoàn tất & Tạo hộp thư';

  const submittingText = isFacebookMulti
    ? `Đang kết nối ${pendingFbPageIds.length} Fanpage...`
    : 'Đang tạo hộp thư...';

  return (
    <Card className="border-border bg-card/40">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Chỉ định nhân viên tiếp nhận hộp thư
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          {isFacebookMulti
            ? `Chọn các nhân viên có quyền tiếp nhận và phản hồi tin nhắn cho ${pendingFbPageIds.length} Fanpage Facebook đã chọn.`
            : `Chọn các nhân viên có quyền tiếp nhận và phản hồi tin nhắn trong hộp thư ${selectedChannel?.title || ''}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Search bar and Select All row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên hoặc email..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 rounded-lg border border-border bg-card/30 px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-members"
                checked={checkboxCheckedState}
                disabled={targetIds.length === 0}
                onCheckedChange={handleToggleSelectAll}
              />
              <label
                htmlFor="select-all-members"
                className={`text-xs font-medium select-none ${
                  targetIds.length === 0
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                {isSearchActive
                  ? `Chọn kết quả (${targetIds.length})`
                  : `Chọn tất cả (${totalMembersCount})`}
              </label>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Đã chọn {selectedMemberUserIds.length}
            </span>
          </div>
        </div>

        {/* Member List */}
        <div className="rounded-lg border border-border bg-card/20 divide-y divide-border/60 max-h-72 overflow-y-auto">
          {isLoadingMembers ? (
            <div className="flex items-center justify-center p-8">
              <Spinner className="size-5 text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {workspaceMembers && workspaceMembers.length > 0
                ? 'Không tìm thấy nhân viên phù hợp với từ khóa tìm kiếm.'
                : 'Không tìm thấy nhân viên nào trong không gian làm việc.'}
            </div>
          ) : (
            filteredMembers.map(member => {
              const isChecked = selectedMemberUserIds.includes(member.userId);
              return (
                <div
                  key={member.id}
                  onClick={() => handleToggleMember(member.userId)}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                    isChecked ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleMember(member.userId)}
                    />
                    <Avatar className="size-8 border border-border">
                      <AvatarImage src={member.user?.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px] font-semibold">
                        {member.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">
                        {member.user?.name || 'Chưa đặt tên'}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {member.user?.email}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono shrink-0">
                    {member.role}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => goToStage('channel_flow')}
            disabled={isSubmitting}
            className="text-xs h-8 gap-1.5"
          >
            <ArrowLeft className="size-3" />
            Quay lại cấu hình kênh
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={completeCreation}
            disabled={isSubmitting}
            className="text-xs h-8 gap-1.5 font-medium"
          >
            {isSubmitting ? (
              <>
                <Spinner className="size-3.5" />
                {submittingText}
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                {submitButtonText}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
