import { MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <MessageSquare className="size-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Conversations</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Select a conversation or wait for incoming omnichannel messages from your connected inboxes.
      </p>
    </div>
  );
}
