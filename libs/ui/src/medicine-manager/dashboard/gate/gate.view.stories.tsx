import type { Meta, StoryObj } from '@storybook/react';
import { GateView } from './gate.view';

const meta: Meta<typeof GateView> = {
  title: 'Medicine Manager/Dashboard/Gate',
  component: GateView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof GateView>;

export const Loading: Story = {
  render: () => (
    <GateView vm={{ state: 'loading' }} onSignOut={() => undefined} />
  ),
};

export const Blocked: Story = {
  render: () => (
    <GateView vm={{ state: 'blocked' }} onSignOut={() => undefined} />
  ),
};
