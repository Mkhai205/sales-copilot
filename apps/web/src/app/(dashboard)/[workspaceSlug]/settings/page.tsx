import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <Settings className="size-6" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">Workspace Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Configure workspace name, inboxes, team members, labels, canned responses, automation rules,
        and webhooks.
      </p>
    </div>
  );
}
