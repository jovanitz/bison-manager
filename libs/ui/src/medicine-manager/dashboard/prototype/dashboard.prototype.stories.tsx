import type { Meta, StoryObj } from '@storybook/react';
import { DashboardPrototype } from './dashboard.prototype';

const meta: Meta<typeof DashboardPrototype> = {
  title: 'Medicine Manager/Dashboard/Prototype',
  component: DashboardPrototype,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof DashboardPrototype>;

/**
 * Clickable, navigable prototype — no real logic. The sidebar switches sections
 * (Directory, Roles, Templates, Audit, Settings…); in the Organizations tab,
 * clicking an org opens its detail (owner + member roster) with a back link.
 * All data is fixtures; mutating actions are no-ops.
 */
export const Navigable: Story = {};
