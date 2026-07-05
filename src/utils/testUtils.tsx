// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { I18nProvider } from './i18n';

export function createTestContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  
  return {
    container,
    root,
    render: async (ui: React.ReactElement) => {
      await act(async () => {
        root.render(<I18nProvider>{ui}</I18nProvider>);
      });
    },
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
}

/**
 * Polls `predicate` until it returns true, flushing React work between attempts.
 *
 * Use this instead of a single fixed-delay flush when an interaction kicks off
 * an async chain (crypto, storage, a lazy import()): the number of macrotasks
 * needed to settle varies with machine speed, so a one-tick wait is flaky on
 * slower CI runners. Throws if the condition is not met within `timeout` ms.
 */
export async function waitFor(predicate: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now();
  for (;;) {
    let satisfied = false;
    try {
      satisfied = predicate();
    } catch {
      satisfied = false;
    }
    if (satisfied) return;
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor: condition not met within ${timeout}ms`);
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}
