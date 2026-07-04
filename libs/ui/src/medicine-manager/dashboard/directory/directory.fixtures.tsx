import type { DirectoryVM } from './directory.view';

const staff = [
  { accountId: 'acc_01', email: 'ana@acme.com', displayName: 'Ana Torres' },
  { accountId: 'acc_02', email: 'beto@acme.com', displayName: 'Beto Ruiz' },
  { accountId: 'acc_03', email: 'cami@acme.com', displayName: 'Cami Díaz' },
];

const customers = [
  {
    accountId: 'org_11',
    displayName: 'Clínica Norte',
    email: 'admin@norte.mx',
  },
  { accountId: 'org_12', displayName: 'Farmacia Sur', email: 'ops@sur.mx' },
  { accountId: 'org_13', displayName: 'Hospital Río', email: 'it@rio.mx' },
  { accountId: 'org_14', displayName: 'Lab Central', email: 'contacto@lab.mx' },
  { accountId: 'org_15', displayName: 'Salud Total', email: 'hola@total.mx' },
];

const pendingInvitations = [
  { invitationId: 'inv_1', email: 'nuevo@norte.mx', expiresAt: '2026-07-09' },
  { invitationId: 'inv_2', email: 'staff@sur.mx', expiresAt: '2026-07-11' },
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
