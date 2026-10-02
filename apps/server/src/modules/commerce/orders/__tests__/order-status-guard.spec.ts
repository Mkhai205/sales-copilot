import { OrderStatus } from '@sales-copilot/shared-contracts';
import {
  assertCanCancel,
  assertCanComplete,
  assertCanConfirm,
  assertCanUpdate,
} from '../order-status-guard';

type GuardAction = 'update' | 'confirm' | 'cancel' | 'complete';

/**
 * The order state machine as a specification table. Each cell is 'ALLOWED'
 * when the action is accepted from that status, otherwise the error code the
 * guard must reject the transition with. A status added to the OrderStatus
 * contract is rejected everywhere until granted explicitly here (fail-closed).
 */
const TRANSITION_MATRIX: Record<OrderStatus, Record<GuardAction, 'ALLOWED' | string>> = {
  [OrderStatus.DRAFT]: {
    update: 'ALLOWED',
    confirm: 'ALLOWED',
    cancel: 'ALLOWED',
    complete: 'INVALID_STATUS_FOR_COMPLETION',
  },
  [OrderStatus.CONFIRMED]: {
    update: 'INVALID_STATUS_FOR_UPDATE',
    confirm: 'INVALID_STATUS_TRANSITION',
    cancel: 'ALLOWED',
    complete: 'ALLOWED',
  },
  [OrderStatus.PAID]: {
    update: 'INVALID_STATUS_FOR_UPDATE',
    confirm: 'INVALID_STATUS_TRANSITION',
    cancel: 'ALLOWED',
    complete: 'ALLOWED',
  },
  [OrderStatus.SHIPPING]: {
    update: 'INVALID_STATUS_FOR_UPDATE',
    confirm: 'INVALID_STATUS_TRANSITION',
    cancel: 'ALLOWED',
    complete: 'ALLOWED',
  },
  [OrderStatus.COMPLETED]: {
    update: 'INVALID_STATUS_FOR_UPDATE',
    confirm: 'INVALID_STATUS_TRANSITION',
    cancel: 'ORDER_ALREADY_COMPLETED',
    complete: 'ORDER_ALREADY_COMPLETED',
  },
  [OrderStatus.CANCELLED]: {
    update: 'INVALID_STATUS_FOR_UPDATE',
    confirm: 'INVALID_STATUS_TRANSITION',
    cancel: 'ORDER_NOT_CANCELLABLE',
    complete: 'INVALID_STATUS_FOR_COMPLETION',
  },
};

const GUARDS: Record<
  GuardAction,
  (order: { id: string; status: OrderStatus | string; items?: unknown[] }) => void
> = {
  update: assertCanUpdate,
  confirm: assertCanConfirm,
  cancel: assertCanCancel,
  complete: assertCanComplete,
};

function orderIn(status: OrderStatus | string, items?: unknown[]) {
  return { id: 'order-1', status, items };
}

function rejectionCodeOf(assert: (order: unknown) => void, order: unknown): string | undefined {
  try {
    assert(order);
    return undefined;
  } catch (err: any) {
    return err?.response?.code;
  }
}

describe('Order status guard (transition matrix)', () => {
  for (const status of Object.values(OrderStatus)) {
    for (const action of Object.keys(TRANSITION_MATRIX[status]) as GuardAction[]) {
      const expected = TRANSITION_MATRIX[status][action];

      it(`${status} + ${action} -> ${expected === 'ALLOWED' ? 'allowed' : `rejected with ${expected}`}`, () => {
        const assert = GUARDS[action];
        // confirm inspects line items too; item presence is asserted separately below
        const order = orderIn(status, [{ variantId: 'variant-1', quantity: 1 }]);

        if (expected === 'ALLOWED') {
          expect(() => assert(order)).not.toThrow();
        } else {
          expect(rejectionCodeOf(assert, order)).toBe(expected);
        }
      });
    }
  }

  describe('confirm requires at least one line item', () => {
    it('rejects a DRAFT order without items with EMPTY_ORDER', () => {
      expect(rejectionCodeOf(assertCanConfirm, orderIn(OrderStatus.DRAFT))).toBe('EMPTY_ORDER');
    });

    it('rejects a DRAFT order with an empty item list with EMPTY_ORDER', () => {
      expect(rejectionCodeOf(assertCanConfirm, orderIn(OrderStatus.DRAFT, []))).toBe('EMPTY_ORDER');
    });

    it('accepts a DRAFT order carrying items', () => {
      expect(() =>
        assertCanConfirm(orderIn(OrderStatus.DRAFT, [{ variantId: 'variant-1', quantity: 1 }])),
      ).not.toThrow();
    });
  });

  describe('statuses outside the contract are rejected by default (fail-closed)', () => {
    const unknownStatus = 'SOME_FUTURE_STATUS';

    it.each([
      ['update', 'INVALID_STATUS_FOR_UPDATE'],
      ['confirm', 'INVALID_STATUS_TRANSITION'],
      ['cancel', 'ORDER_NOT_CANCELLABLE'],
      ['complete', 'INVALID_STATUS_FOR_COMPLETION'],
    ] as const)('%s on an unknown status is rejected with %s', (action, expected) => {
      const assert = GUARDS[action];
      expect(
        rejectionCodeOf(assert, orderIn(unknownStatus, [{ variantId: 'variant-1', quantity: 1 }])),
      ).toBe(expected);
    });
  });
});
