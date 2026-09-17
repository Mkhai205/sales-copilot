import type { ToolSet } from 'ai';
import { CommerceToolRegistry, type CommerceToolBuildContext } from './commerce-tool.registry';

export type ToolBuildContext = CommerceToolBuildContext;
export { CommerceToolRegistry, CommerceToolBuildContext };

export * from './commerce/search-products.tool';
export * from './commerce/get-product-details.tool';
export * from './commerce/check-inventory.tool';
export * from './commerce/extract-shipping-info.tool';
export * from './commerce/evaluate-discount.tool';
export * from './commerce/create-draft-order.tool';
export * from './commerce/confirm-and-generate-qr.tool';
export * from './commerce/update-contact-info.tool';
export * from './commerce/escalate-to-human.tool';

/**
 * Builds registered tools available for the AI Agent loop.
 * Retained for backward compatibility with Epic 3.1 callers.
 */
export function buildAgentTools(_context: ToolBuildContext): ToolSet {
  return {};
}
