import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CurrentAccessDto } from '@acme/application';
import {
  mockAccessUseCases,
  mockItems,
  testCurrentAccess,
} from '../../access/testing';
import { mockSettings, testPolicies } from '../testing';
import { UseCasesProvider, type AppUseCases } from '../../di/use-cases-context';
import { SettingsSection } from './settings-section';

const OWNER: CurrentAccessDto = {
  ...testCurrentAccess,
  permissions: [{ action: 'settings.update', scope: 'any' }],
};

const renderSection = (useCases: Partial<AppUseCases>, access = OWNER) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({ currentAccess: async () => ok(access) }),
        ...useCases,
      }}
    >
      <SettingsSection />
    </UseCasesProvider>,
  );

describe('SettingsSection', () => {
  it('shows the current policy and saves an edit (owner only)', async () => {
    const update = vi.fn(async () => ok(undefined));
    renderSection({ settings: mockSettings({ update }) });
    const staffIdle = await screen.findByLabelText('staff idle');
    expect(staffIdle).toHaveValue(testPolicies.staff.idleTtlMs);
    fireEvent.change(staffIdle, { target: { value: '600000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        customer: testPolicies.customer,
        staff: {
          idleTtlMs: 600000,
          maxLifetimeMs: testPolicies.staff.maxLifetimeMs,
        },
      }),
    );
  });

  it('hides itself without settings.update', async () => {
    renderSection(
      { settings: mockSettings() },
      {
        ...testCurrentAccess,
        permissions: [{ action: 'staff.read', scope: 'any' }],
      },
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'session policy' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('renders nothing when settings is not wired', () => {
    render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <SettingsSection />
      </UseCasesProvider>,
    );
    expect(
      screen.queryByRole('form', { name: 'session policy' }),
    ).not.toBeInTheDocument();
  });
});
