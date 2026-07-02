import type { Meta, StoryObj } from '@storybook/react';
import { Users } from 'lucide-react';
import { EmptyState } from './empty-state';
import { Button } from '../button/button';

const meta: Meta<typeof EmptyState> = {
  title: 'Design System/Empty State',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <EmptyState
        icon={<Users />}
        title="No members yet"
        description="Invite teammates to this organization to start collaborating."
        action={<Button size="sm">Invite member</Button>}
      />
    </div>
  ),
};

/** Minimal — no icon or action (e.g. an empty search result). */
export const Minimal: Story = {
  render: () => (
    <div className="w-96">
      <EmptyState
        title="No results"
        description="Try a different search term."
      />
    </div>
  ),
};
