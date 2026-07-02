import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from './switch';
import { Label } from '../label/label';

const meta: Meta<typeof Switch> = {
  title: 'Design System/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = { args: { defaultChecked: true } };
export const Off: Story = {};
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

/** With a label (a settings row). */
export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="notifications" defaultChecked />
      <Label htmlFor="notifications">Email notifications</Label>
    </div>
  ),
};
