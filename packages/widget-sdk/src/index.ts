import { SalesCopilotWidget } from './widget';
import { UserIdentity } from './types';

// Export all types and classes
export * from './types';
export * from './api';
export * from './socket';
export * from './ui';
export * from './widget';

// Global singleton instance
export const widgetInstance = new SalesCopilotWidget();

// Attach to browser global window object
if (typeof window !== 'undefined') {
  (window as any).SalesCopilotWidget = widgetInstance;
  // Chatwoot SDK compatibility alias
  (window as any).chatwootSDK = {
    run: (config: { websiteToken: string; baseUrl: string }) => widgetInstance.init(config),
    setUser: (identifier: string, user?: Partial<UserIdentity>) =>
      widgetInstance.setUser({ identifier, ...(user || {}) }),
    setCustomAttributes: (attributes: Record<string, unknown>) =>
      widgetInstance.setCustomAttributes(attributes),
    reset: () => widgetInstance.resetSession(),
    toggle: (state?: boolean) => widgetInstance.toggle(state),
    on: (event: any, callback: any) => widgetInstance.on(event, callback),
  };
}

export default widgetInstance;
