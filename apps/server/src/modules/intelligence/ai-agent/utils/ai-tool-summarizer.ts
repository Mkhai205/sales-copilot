/**
 * Helper to produce clean, concise, human-readable summaries for AI tool outputs.
 * Prevents metadata ballooning while providing actionable observability in logs and UI.
 */
export function summarizeToolOutput(toolName: string, output: unknown): string {
  if (output === null || output === undefined) {
    return 'No output';
  }

  // Handle generic structured error response from tools
  if (typeof output === 'object' && output !== null) {
    const obj = output as Record<string, any>;
    if (obj.error) {
      const msg = obj.message ? `: ${obj.message}` : '';
      return truncate(`Error: ${obj.error}${msg}`, 200);
    }
  }

  try {
    switch (toolName) {
      case 'searchProducts': {
        if (Array.isArray(output)) {
          if (output.length === 0) return 'No products found';
          const names = output
            .slice(0, 2)
            .map(p => `"${p.name || p.productId || 'Unknown'}"`)
            .join(', ');
          const extra = output.length > 2 ? ` +${output.length - 2} more` : '';
          return `Found ${output.length} products (${names}${extra})`;
        }
        break;
      }

      case 'getProductDetails': {
        if (typeof output === 'object' && output !== null) {
          const p = output as Record<string, any>;
          const variantCount = Array.isArray(p.variants) ? p.variants.length : 0;
          return `Product details for "${p.name || p.id}" (${variantCount} variants)`;
        }
        break;
      }

      case 'checkInventory': {
        if (typeof output === 'object' && output !== null) {
          const inv = output as Record<string, any>;
          if (inv.inStock === false || inv.availableStock <= 0) {
            return 'Out of stock';
          }
          return `In stock: ${inv.availableStock ?? inv.quantity ?? 0} available`;
        }
        break;
      }

      case 'createDraftOrder': {
        if (typeof output === 'object' && output !== null) {
          const o = output as Record<string, any>;
          const num = o.orderNumber
            ? `#${o.orderNumber}`
            : o.orderId
              ? `#${String(o.orderId).slice(0, 8)}`
              : '';
          const total =
            typeof o.totalAmount === 'number'
              ? ` Total: ${o.totalAmount.toLocaleString('vi-VN')}₫`
              : '';
          return `Draft order ${num} created,${total}`.trim();
        }
        break;
      }

      case 'confirmAndGenerateQR': {
        if (typeof output === 'object' && output !== null) {
          const qr = output as Record<string, any>;
          const num = qr.orderNumber
            ? `#${qr.orderNumber}`
            : qr.orderId
              ? `#${String(qr.orderId).slice(0, 8)}`
              : '';
          return `Generated payment QR for order ${num}`.trim();
        }
        break;
      }

      case 'extractShippingInfo': {
        if (typeof output === 'object' && output !== null) {
          const s = output as Record<string, any>;
          const parts = [s.streetAddress, s.ward, s.district, s.province].filter(Boolean);
          const conf =
            typeof s.confidenceScore === 'number'
              ? ` (${Math.round(s.confidenceScore * 100)}% conf)`
              : '';
          return parts.length > 0
            ? `Extracted address: ${parts.join(', ')}${conf}`
            : `Extracted address${conf}`;
        }
        break;
      }

      case 'updateContactInfo': {
        if (typeof output === 'object' && output !== null) {
          const c = output as Record<string, any>;
          const info = [c.name, c.phoneNumber].filter(Boolean).join(', ');
          return `Contact updated: ${info || 'Success'}`;
        }
        break;
      }

      case 'escalateToHuman': {
        if (typeof output === 'object' && output !== null) {
          const esc = output as Record<string, any>;
          return `Escalated to human agent: ${esc.reason || 'Requested'}`;
        }
        break;
      }

      case 'evaluateDiscount': {
        if (typeof output === 'object' && output !== null) {
          const d = output as Record<string, any>;
          if (d.approved) {
            const amount =
              typeof d.approvedDiscount === 'number'
                ? `${d.approvedDiscount.toLocaleString('vi-VN')}₫`
                : '';
            return `Discount approved: ${amount}`.trim();
          }
          return `Discount rejected: ${d.reason || 'Exceeded policy'}`;
        }
        break;
      }

      case 'searchKnowledge': {
        if (Array.isArray(output)) {
          return `Found ${output.length} knowledge articles`;
        }
        break;
      }

      default:
        break;
    }
  } catch {
    // If any specialized formatter fails, fall through to default serializer
  }

  // Fallback: JSON stringify or primitive toString
  if (typeof output === 'string') {
    return truncate(output, 200);
  }

  try {
    return truncate(JSON.stringify(output), 200);
  } catch {
    return truncate(String(output), 200);
  }
}

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3)}...`;
}
