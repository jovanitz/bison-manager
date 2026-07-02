import type { Meta, StoryObj } from '@storybook/react';
import { CreditCard, Settings, User } from 'lucide-react';
import { UserMenu } from './user-menu';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu';

const meta: Meta<typeof UserMenu> = {
  title: 'Design System/User Menu',
  component: UserMenu,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    name: 'Josh Torres',
    email: 'josh@acme.com',
    onSignOut: () => console.log('sign out'),
    children: (
      <>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard />
          Billing
        </DropdownMenuItem>
      </>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof UserMenu>;

/** Avatar-only trigger (compact, for a busy topbar). */
export const Default: Story = {};

/** Avatar + name + chevron (roomier topbars). */
export const WithName: Story = { args: { showName: true } };

export const WithPhoto: Story = {
  args: { showName: true, avatarSrc: 'https://i.pravatar.cc/80?img=12' },
};
