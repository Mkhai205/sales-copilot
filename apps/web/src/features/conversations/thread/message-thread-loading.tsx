import { Skeleton } from '@/components/ui/skeleton';

export function MessageThreadLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Inbound Skeleton */}
      <div className="flex items-start gap-2.5 max-w-[70%]">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 w-full">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-64 rounded-lg" />
        </div>
      </div>

      {/* Outbound Skeleton */}
      <div className="flex items-end flex-col gap-1.5 self-end max-w-[70%]">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>

      {/* Inbound Skeleton */}
      <div className="flex items-start gap-2.5 max-w-[70%]">
        <Skeleton className="size-7 rounded-full shrink-0" />
        <div className="flex flex-col gap-1.5 w-full">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-20 w-72 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
