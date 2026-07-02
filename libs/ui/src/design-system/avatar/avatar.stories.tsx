import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Design System/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { fallback: 'JT' },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="sm" fallback="SM" />
      <Avatar size="md" fallback="MD" />
      <Avatar size="lg" fallback="LG" />
    </div>
  ),
};

export const WithImage: Story = {
  args: {
    size: 'lg',
    src: 'https://i.pravatar.cc/80?img=12',
    alt: 'Jane Doe',
  },
};

/** No `src` (or a broken one) → initials fallback. */
export const Fallback: Story = { args: { size: 'lg', fallback: 'JD' } };

/** Override shape + colors via className — the organization-logo variant. */
export const OrgLogo: Story = {
  render: () => (
    <Avatar
      size="lg"
      fallback="AC"
      className="rounded-md bg-primary text-primary-foreground"
    />
  ),
};

/** Presence dot — colored via the status tokens (online=success, away=warning,
 *  busy=destructive, offline=muted). */
export const Presence: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="lg" fallback="ON" status="online" />
      <Avatar size="lg" fallback="AW" status="away" />
      <Avatar size="lg" fallback="BS" status="busy" />
      <Avatar size="lg" fallback="OF" status="offline" />
    </div>
  ),
};
