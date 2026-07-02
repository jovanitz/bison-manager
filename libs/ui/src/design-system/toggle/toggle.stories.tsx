import type { Meta, StoryObj } from '@storybook/react';
import { Bold } from 'lucide-react';
import { Toggle } from './toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Design System/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  render: () => (
    <Toggle aria-label="Bold">
      <Bold />
    </Toggle>
  ),
};

export const WithText: Story = {
  render: () => <Toggle>Italic</Toggle>,
};

export const Outline: Story = {
  render: () => (
    <Toggle variant="outline" defaultPressed aria-label="Bold">
      <Bold />
    </Toggle>
  ),
};
