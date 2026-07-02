import type { Meta, StoryObj } from '@storybook/react';
import { ScrollArea } from './scroll-area';

const meta: Meta<typeof ScrollArea> = {
  title: 'Design System/Scroll Area',
  component: ScrollArea,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ScrollArea>;

const tags = Array.from({ length: 24 }, (_, i) => `Member ${i + 1}`);

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-48 w-56 rounded-md border border-border">
      <div className="p-3">
        {tags.map((t) => (
          <div
            key={t}
            className="border-b border-border py-2 text-sm last:border-0"
          >
            {t}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
