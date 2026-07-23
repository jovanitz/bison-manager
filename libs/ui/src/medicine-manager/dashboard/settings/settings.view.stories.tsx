import type { Meta, StoryObj } from '@storybook/react';
import { SettingsView } from './settings.view';
import { DashboardShell } from '../dashboard.shell';

const meta: Meta<typeof SettingsView> = {
  title: 'Medicine Manager/Dashboard/Settings',
  component: SettingsView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof SettingsView>;

const policy = {
  customerIdle: 900000,
  customerMax: 28800000,
  staffIdle: 1800000,
  staffMax: 43200000,
};

const inShell = (vm: Parameters<typeof SettingsView>[0]['vm']) =>
  function Render() {
    return (
      <DashboardShell active="Settings">
        <SettingsView vm={vm} onSave={() => undefined} />
      </DashboardShell>
    );
  };

/** Staff with settings.update: the editable session-policy form. */
export const Default: Story = {
  render: inShell({ policy, canManage: true, loading: false }),
};
export const Loading: Story = {
  render: inShell({ policy, canManage: false, loading: true }),
};
/** No settings.update — inputs disabled, no save; a note explains why. */
export const ReadOnly: Story = {
  render: inShell({ policy, canManage: false, loading: false }),
};
/** A save that failed — the error surfaces inline above the form. */
export const SaveError: Story = {
  render: inShell({
    policy,
    canManage: true,
    loading: false,
    error: 'The settings service didn’t respond. Please try again.',
  }),
};
