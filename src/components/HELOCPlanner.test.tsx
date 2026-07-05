import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { HELOCPlanner } from './HELOCPlanner';
import { createTestContainer } from '../utils/testUtils';

describe('HELOCPlanner Component Integration Tests', () => {
  let testEnv: ReturnType<typeof createTestContainer>;

  beforeEach(() => {
    testEnv = createTestContainer();
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  it('renders without crashing with null profile', async () => {
    await testEnv.render(<HELOCPlanner profile={null} onSaveProfile={() => {}} />);

    expect(testEnv.container.innerHTML).toContain('Home Market Value');
    expect(testEnv.container.innerHTML).toContain('Outstanding Mortgage');
  });
});
