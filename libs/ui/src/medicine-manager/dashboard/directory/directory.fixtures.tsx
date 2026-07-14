import type { CustomerRow } from './directory.columns';
import type { DirectoryVM } from './directory.view';

const staff = [
  {
    accountId: 'acc_01',
    email: 'ana@acme.com',
    displayName: 'Ana Torres',
    lastActiveAt: '2026-07-07',
    // The signed-in staff — self-moderation is guarded.
    isSelf: true,
  },
  {
    accountId: 'acc_02',
    email: 'beto@acme.com',
    displayName: 'Beto Ruiz',
    lastActiveAt: '2026-06-28',
    blocked: true,
  },
  {
    accountId: 'acc_03',
    email: 'cami@acme.com',
    displayName: 'Cami Díaz',
    lastActiveAt: '2026-07-05',
    // Protected root — cannot be blocked/disabled/demoted.
    isRoot: true,
  },
];

const customers: readonly CustomerRow[] = [
  {
    accountId: 'org_11',
    displayName: 'Clínica Norte',
    email: 'admin@norte.mx',
    memberCount: 24,
    plan: 'Pro',
    phase: 'active',
    createdAt: '2026-03-14',
    lastActiveAt: '2026-07-07',
    lastPaymentAt: '2026-07-01',
  },
  {
    accountId: 'org_12',
    displayName: 'Farmacia Sur',
    email: 'ops@sur.mx',
    memberCount: 8,
    plan: 'Free',
    phase: 'grace',
    createdAt: '2026-05-02',
    lastActiveAt: '2026-07-06',
    lastPaymentAt: '2026-05-15',
    overduePayments: 1,
  },
  {
    accountId: 'org_13',
    displayName: 'Hospital Río',
    email: 'it@rio.mx',
    memberCount: 57,
    plan: 'Pro',
    phase: 'suspended',
    createdAt: '2026-01-20',
    lastActiveAt: '2026-06-30',
    lastPaymentAt: '2026-03-10',
    overduePayments: 2,
    dormant: true,
  },
  {
    accountId: 'org_14',
    displayName: 'Lab Central',
    email: 'contacto@lab.mx',
    memberCount: 3,
    plan: 'Free',
    phase: 'active',
    createdAt: '2026-06-10',
    lastActiveAt: '2026-07-07',
    lastPaymentAt: '2026-07-05',
  },
  {
    accountId: 'org_15',
    displayName: 'Salud Total',
    email: 'hola@total.mx',
    memberCount: 12,
    plan: 'Pro',
    phase: 'suspended',
    createdAt: '2025-11-05',
    lastActiveAt: '2026-05-15',
    lastPaymentAt: '2026-06-05',
    overduePayments: 2,
  },
  {
    accountId: 'org_16',
    displayName: 'Óptica Vista',
    email: 'admin@vista.mx',
    memberCount: 4,
    plan: 'Free',
    phase: 'suspended',
    createdAt: '2025-09-18',
    lastActiveAt: '2026-04-02',
    lastPaymentAt: '2026-02-20',
    overduePayments: 2,
    dormant: true,
    // Already in the reversible 30-day pending-deletion window.
    pendingDeletionUntil: '2026-08-05',
  },
];

const pendingInvitations = [
  {
    invitationId: 'inv_1',
    email: 'nuevo@norte.mx',
    expiresAt: '2026-07-09',
    status: 'expiring' as const,
  },
  {
    invitationId: 'inv_2',
    email: 'staff@sur.mx',
    expiresAt: '2026-07-11',
    status: 'pending' as const,
  },
  {
    invitationId: 'inv_3',
    email: 'old@lab.mx',
    expiresAt: '2026-07-02',
    status: 'expired' as const,
  },
];

const orphans = [
  { userId: 'usr_9', email: 'perdido@gmail.com', createdAt: '2026-06-30' },
];

export const populatedVM: DirectoryVM = {
  staff,
  customers,
  pendingInvitations,
  orphans,
  canBlock: true,
  canAdminAccounts: true,
  loading: false,
};
export const limitedVM: DirectoryVM = {
  ...populatedVM,
  canBlock: false,
  canAdminAccounts: false,
};
export const loadingVM: DirectoryVM = {
  staff: [],
  customers: [],
  pendingInvitations: [],
  orphans: [],
  canBlock: false,
  canAdminAccounts: false,
  loading: true,
};
export const errorVM: DirectoryVM = {
  ...loadingVM,
  loading: false,
  error: 'Could not reach the directory service.',
};
