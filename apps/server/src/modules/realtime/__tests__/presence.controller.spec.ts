import { PresenceController } from '../presence.controller';
import { PresenceStatus } from '@sales-copilot/shared-contracts';

describe('PresenceController', () => {
  let controller: PresenceController;
  const presenceCalls: Array<{ workspaceId: string; includeOffline: boolean }> = [];

  beforeEach(() => {
    presenceCalls.length = 0;
    const presenceServiceMock = {
      getWorkspacePresence: async (workspaceId: string, includeOffline: boolean) => {
        presenceCalls.push({ workspaceId, includeOffline });
        return [
          { userId: 'usr_1', status: PresenceStatus.ONLINE, lastSeenAt: new Date().toISOString() },
        ];
      },
    };
    controller = new PresenceController(presenceServiceMock as any);
  });

  const workspaceContext = { workspaceId: 'ws_1', role: 'AGENT', workspace: {} } as any;

  it('should seed the presence snapshot for the workspace resolved by WorkspaceGuard', async () => {
    const result = await controller.getWorkspacePresence(workspaceContext, 'true');

    expect(result.length).toBe(1);
    expect(presenceCalls).toEqual([{ workspaceId: 'ws_1', includeOffline: true }]);
  });

  it('should accept the "1" shorthand for includeOffline', async () => {
    await controller.getWorkspacePresence(workspaceContext, '1');

    expect(presenceCalls).toEqual([{ workspaceId: 'ws_1', includeOffline: true }]);
  });

  it('should default to online-only when includeOffline is absent or not a truthy flag', async () => {
    await controller.getWorkspacePresence(workspaceContext, undefined);
    await controller.getWorkspacePresence(workspaceContext, '0');

    expect(presenceCalls).toEqual([
      { workspaceId: 'ws_1', includeOffline: false },
      { workspaceId: 'ws_1', includeOffline: false },
    ]);
  });
});
