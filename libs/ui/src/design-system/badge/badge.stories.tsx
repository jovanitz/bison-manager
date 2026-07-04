import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Badge' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'success',
        'warning',
        'outline',
      ],
    },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Success: Story = {
  args: { variant: 'success', children: 'Active' },
};
export const Warning: Story = {
  args: { variant: 'warning', children: 'Pending' },
};
export const Outline: Story = { args: { variant: 'outline' } };

/** All status variants side by side. */
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="success">Active</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="secondary">Draft</Badge>
    </div>
  ),
};

/** Soft status pills: faint tint + tone-colored label + a leading dot. The
 *  low-noise style for row/table status. */
export const Soft: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success" appearance="soft" dot>
        active
      </Badge>
      <Badge variant="warning" appearance="soft" dot>
        invited
      </Badge>
      <Badge variant="destructive" appearance="soft" dot>
        blocked
      </Badge>
      <Badge variant="secondary" appearance="soft" dot>
        archived
      </Badge>
    </div>
  ),
};

/** Soft (new, low-noise) vs. solid (loud) for the same three statuses. */
export const SoftVsSolid: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 text-xs text-muted-foreground">Soft</span>
        <Badge variant="success" appearance="soft" dot>
          active
        </Badge>
        <Badge variant="warning" appearance="soft" dot>
          invited
        </Badge>
        <Badge variant="destructive" appearance="soft" dot>
          blocked
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 text-xs text-muted-foreground">Solid</span>
        <Badge variant="success">active</Badge>
        <Badge variant="warning">invited</Badge>
        <Badge variant="destructive">blocked</Badge>
      </div>
    </div>
  ),
};
