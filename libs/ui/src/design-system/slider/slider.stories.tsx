import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './slider';

const meta: Meta<typeof Slider> = {
  title: 'Design System/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: () => (
    <div className="w-72">
      <Slider defaultValue={[50]} max={100} step={1} />
    </div>
  ),
};

export const Steps: Story = {
  render: () => (
    <div className="w-72">
      <Slider defaultValue={[40]} max={100} step={10} />
    </div>
  ),
};
