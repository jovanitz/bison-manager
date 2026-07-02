import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'Design System/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } } },
};
export default meta;

type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: { value: 60 },
  render: (args) => (
    <div className="w-72">
      <Progress {...args} />
    </div>
  ),
};

export const Steps: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <Progress value={25} />
      <Progress value={60} />
      <Progress value={100} />
    </div>
  ),
};
