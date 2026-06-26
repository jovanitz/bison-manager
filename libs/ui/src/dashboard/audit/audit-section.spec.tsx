import { describe, expect, it } from 'vitest';
import { ok } from '@acme/shared';
import { render, screen, waitFor } from '@testing-library/react';
import type { CurrentAccessDto } from '@acme/application';
import {
  mockAccessUseCases,
  mockItems,
  testCurrentAccess,
} from '../../access/testing';
import { mockAudit } from '../testing';
import { UseCasesProvider, type AppUseCases } from '../../di/use-cases-context';
import { AuditSection } from './audit-section';

const AUDITOR: CurrentAccessDto = {
  ...testCurrentAccess,
  permissions: [{ action: 'audit.read', scope: 'any' }],
};

const renderSection = (useCases: Partial<AppUseCases>, access = AUDITOR) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({ currentAccess: async () => ok(access) }),
        ...useCases,
      }}
    >
      <AuditSection />
    </UseCasesProvider>,
  );

describe('AuditSection', () => {
  it('renders the audit trail for an actor with audit.read', async () => {
    renderSection({ audit: mockAudit() });
    expect(
      await screen.findByRole('table', { name: 'audit trail' }),
    ).toBeInTheDocument();
    expect(screen.getByText('account.disabled')).toBeInTheDocument();
  });

  it('hides itself without audit.read', async () => {
    renderSection(
      { audit: mockAudit() },
      {
        ...testCurrentAccess,
        permissions: [{ action: 'staff.read', scope: 'any' }],
      },
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('table', { name: 'audit trail' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('renders nothing when audit is not wired', () => {
    render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <AuditSection />
      </UseCasesProvider>,
    );
    expect(
      screen.queryByRole('table', { name: 'audit trail' }),
    ).not.toBeInTheDocument();
  });
});
