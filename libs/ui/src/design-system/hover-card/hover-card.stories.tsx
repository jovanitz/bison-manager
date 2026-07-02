import type { Meta, StoryObj } from '@storybook/react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';
import { Avatar } from '../avatar/avatar';
import { Button } from '../button/button';

const meta: Meta<typeof HoverCard> = {
  title: 'Design System/Hover Card',
  component: HoverCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof HoverCard>;

/** Hover the trigger to preview the member card. */
export const Member: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@ana</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex gap-3">
          <Avatar size="lg" fallback="AT" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Ana Torres</p>
            <p className="text-sm text-muted-foreground">
              Owner at Acme Inc. · joined 2024.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
