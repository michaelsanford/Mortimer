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
