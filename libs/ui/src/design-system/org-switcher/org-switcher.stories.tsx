import type { Meta, StoryObj } from '@storybook/react';
import { OrgSwitcher, type Org } from './org-switcher';

const orgs: readonly Org[] = [
  { id: 'acme', name: 'Acme Inc.', fallback: 'AC', owner: true },
  { id: 'globex', name: 'Globex Corp.', fallback: 'GX', caption: 'Admin' },
  { id: 'initech', name: 'Initech', fallback: 'IN', caption: 'Member' },
];

const meta: Meta<typeof OrgSwitcher> = {
  title: 'Design System/Org Switcher',
  component: OrgSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    current: orgs[0],
    orgs,
    onSelect: (id: string) => console.log('switch org', id),
    onCreate: () => console.log('create org'),
  },
};
export default meta;

type Story = StoryObj<typeof OrgSwitcher>;

/** You own one org (Owner badge). Since you already own one, "Create
 *  organization" is hidden (canCreate=false). */
export const OwnsAnOrg: Story = { args: { canCreate: false } };

/** No owned org yet → "Create organization" is offered. */
export const CanCreate: Story = {
  args: {
    orgs: [
      { id: 'globex', name: 'Globex Corp.', fallback: 'GX', caption: 'Admin' },
    ],
    current: {
      id: 'globex',
      name: 'Globex Corp.',
      fallback: 'GX',
      caption: 'Admin',
    },
    canCreate: true,
  },
};
