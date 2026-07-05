// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HELOCPlanner } from './HELOCPlanner';
import { I18nProvider } from '../utils/i18n';

describe('HELOCPlanner Component Integration Tests', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root!.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    container = null;
    root = null;
  });

  it('renders without crashing with null profile', async () => {
    await act(async () => {
      root!.render(
        <I18nProvider>
          <HELOCPlanner profile={null} onSaveProfile={() => {}} />
        </I18nProvider>
      );
    });

    expect(container!.innerHTML).toContain('Home Market Value');
    expect(container!.innerHTML).toContain('Outstanding Mortgage');
  });
});
