import type { Meta, StoryObj } from '@storybook/react';
import { OrgSwitcher, type Org } from './org-switcher';

const orgs: readonly Org[] = [
  { id: 'acme', name: 'Acme Inc.', fallback: 'AC', caption: 'Owner' },
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

export const Default: Story = {};

/** A single-org account still works (the menu just lists one + Create). */
export const SingleOrg: Story = {
  args: { current: orgs[0], orgs: [orgs[0]] },
};
