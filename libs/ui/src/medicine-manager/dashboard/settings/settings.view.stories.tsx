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

export const Default: Story = {
  render: () => (
    <DashboardShell active="Settings">
      <SettingsView
        vm={{
          policy: {
            customerIdle: 900000,
            customerMax: 28800000,
            staffIdle: 1800000,
            staffMax: 43200000,
          },
        }}
        onSave={() => undefined}
      />
    </DashboardShell>
  ),
};
