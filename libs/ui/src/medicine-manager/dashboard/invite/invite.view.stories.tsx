import type { Meta, StoryObj } from '@storybook/react';
import { InviteView, type InviteVM } from './invite.view';
import { DashboardShell } from '../dashboard.shell';

const meta: Meta<typeof InviteView> = {
  title: 'Medicine Manager/Dashboard/Invite Staff',
  component: InviteView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof InviteView>;

const inShell = (vm: InviteVM) =>
  function Render() {
    return (
      <DashboardShell active="Invite">
        <InviteView vm={vm} onInvite={() => undefined} />
      </DashboardShell>
    );
  };

export const Default: Story = { render: inShell({ busy: false }) };
export const WithLink: Story = {
  render: inShell({
    busy: false,
    activationLink: 'https://app.acme.com/activate#token=abc123',
  }),
};
export const LoadError: Story = {
  render: inShell({
    busy: false,
    error: 'That email already has a staff account.',
  }),
};
