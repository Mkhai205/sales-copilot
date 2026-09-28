import { SalesCopilotWidget } from './widget';

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
}

export default widgetInstance;
