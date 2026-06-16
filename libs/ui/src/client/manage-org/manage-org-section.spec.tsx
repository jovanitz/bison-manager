import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AccessClientUseCases,
  CurrentAccessDto,
  MemberSummaryDto,
} from '@acme/application';
import {
  mockAccessUseCases,
  mockItems,
  testCurrentAccess,
} from '../../access/testing';
import { mockInvitations, mockMembers } from '../../dashboard/testing';
import { UseCasesProvider, type AppUseCases } from '../../di/use-cases-context';
import { ManageOrgSection } from './manage-org-section';

const ADMIN: CurrentAccessDto = {
  ...testCurrentAccess,
  permissions: [
    { action: 'members.read', scope: 'own' },
    { action: 'members.invite', scope: 'own' },
    { action: 'permissions.update', scope: 'own' },
    { action: 'members.remove', scope: 'own' },
    { action: 'members.block', scope: 'own' },
  ],
};

const ORG_MEMBERS: ReadonlyArray<MemberSummaryDto> = [
  {
    membershipId: 'm-1',
    userId: 'alice@org.test',
    permissions: [],
    isRoot: false,
    blocked: false,
  },
];

const renderSection = (useCases: Partial<AppUseCases>) =>
  render(
    <UseCasesProvider useCases={{ items: mockItems, ...useCases }}>
      <ManageOrgSection />
    </UseCasesProvider>,
  );

const adminAccess = (
  overrides: Partial<AccessClientUseCases> = {},
): AccessClientUseCases =>
  mockAccessUseCases({ currentAccess: async () => ok(ADMIN), ...overrides });

describe('ManageOrgSection', () => {
  it('hides itself for a member without members.read', async () => {
    const { container } = renderSection({
      access: mockAccessUseCases({}),
      members: mockMembers(),
      invitations: mockInvitations(),
    });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the roster and invite control for an org admin', async () => {
    renderSection({
      access: adminAccess(),
      members: mockMembers({ listMembers: async () => ok(ORG_MEMBERS) }),
      invitations: mockInvitations(),
    });
    await waitFor(() =>
      expect(screen.getByRole('form', { name: 'invite' })).toBeInTheDocument(),
    );
    expect(screen.getByText('alice@org.test')).toBeInTheDocument();
  });

  it('only offers delegable actions in the permission picker', async () => {
    renderSection({
      access: adminAccess(),
      members: mockMembers({ listMembers: async () => ok(ORG_MEMBERS) }),
      invitations: mockInvitations(),
    });
    await waitFor(() => screen.getByLabelText('action'));
    const options = Array.from(
      screen.getByLabelText('action').querySelectorAll('option'),
    ).map((o) => o.textContent);
    // delegable subset only — staff.read / access.block must never appear
    expect(options).toContain('members.invite');
    expect(options).not.toContain('staff.read');
    expect(options).not.toContain('access.block');
  });

  it('blocks a member through the members use case', async () => {
    const setMemberBlocked = vi.fn(async () => ok(undefined));
    renderSection({
      access: adminAccess(),
      members: mockMembers({
        listMembers: async () => ok(ORG_MEMBERS),
        setMemberBlocked,
      }),
      invitations: mockInvitations(),
    });
    await waitFor(() => screen.getByText('alice@org.test'));
    await userEvent.click(
      screen.getByRole('button', { name: /^block alice@org.test/i }),
    );
    expect(setMemberBlocked).toHaveBeenCalledWith({
      membershipId: 'm-1',
      blocked: true,
    });
  });

  it('removes a member through the members use case', async () => {
    const removeMember = vi.fn(async () => ok(undefined));
    const listMembers = vi
      .fn<
        () => Promise<ReturnType<typeof ok<ReadonlyArray<MemberSummaryDto>>>>
      >()
      .mockResolvedValueOnce(ok(ORG_MEMBERS))
      .mockResolvedValue(ok([]));
    renderSection({
      access: adminAccess(),
      members: mockMembers({ listMembers, removeMember }),
      invitations: mockInvitations(),
    });
    await waitFor(() => screen.getByText('alice@org.test'));
    await userEvent.click(
      screen.getByRole('button', { name: /remove alice@org.test/i }),
    );
    expect(removeMember).toHaveBeenCalledWith({ membershipId: 'm-1' });
  });
});
