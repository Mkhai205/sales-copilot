/**
 * Test assertion utilities for native Jest test suites.
 * Provides type-safe, ergonomic error rejection/throw assertions
 * without depending on node:assert or external shims.
 */

export function assertDefined<T>(val: T, _message?: string): asserts val is NonNullable<T> {
  expect(val).toBeDefined();
  expect(val).not.toBeNull();
}

export async function expectReject(
  action: Promise<any> | (() => Promise<any>),
  matcher?: any,
): Promise<any> {
  let caught: any;
  let didThrow = false;
  try {
    if (typeof action === 'function') {
      await action();
    } else {
      await action;
    }
  } catch (err) {
    didThrow = true;
    caught = err;
  }

  expect(didThrow).toBe(true);

  if (matcher !== undefined && matcher !== null) {
    if (typeof matcher === 'function') {
      // Check if matcher is an Error constructor or a predicate function
      if (
        matcher.prototype instanceof Error ||
        matcher === Error ||
        (matcher.name && (matcher.name.endsWith('Exception') || matcher.name.endsWith('Error')))
      ) {
        expect(caught).toBeInstanceOf(matcher);
      } else {
        const res = matcher(caught);
        if (res === false) {
          throw new Error(
            `Predicate assertion failed for thrown error: ${caught?.message || caught}`,
          );
        }
      }
    } else if (matcher instanceof RegExp) {
      expect(caught?.message || String(caught)).toMatch(matcher);
    } else if (typeof matcher === 'object') {
      expect(caught).toMatchObject(matcher);
    }
  }

  return caught;
}

export function expectThrow(action: () => any, matcher?: any): any {
  let caught: any;
  let didThrow = false;
  try {
    action();
  } catch (err) {
    didThrow = true;
    caught = err;
  }

  expect(didThrow).toBe(true);

  if (matcher !== undefined && matcher !== null) {
    if (typeof matcher === 'function') {
      if (
        matcher.prototype instanceof Error ||
        matcher === Error ||
        (matcher.name && (matcher.name.endsWith('Exception') || matcher.name.endsWith('Error')))
      ) {
        expect(caught).toBeInstanceOf(matcher);
      } else {
        const res = matcher(caught);
        if (res === false) {
          throw new Error(
            `Predicate assertion failed for thrown error: ${caught?.message || caught}`,
          );
        }
      }
    } else if (matcher instanceof RegExp) {
      expect(caught?.message || String(caught)).toMatch(matcher);
    } else if (typeof matcher === 'object') {
      expect(caught).toMatchObject(matcher);
    }
  }

  return caught;
}
