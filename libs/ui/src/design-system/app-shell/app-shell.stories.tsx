import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AppShell } from './app-shell';
import {
  BottomItems,
  CmdPalette,
  Content,
  Head,
  Nav,
} from './app-shell.fixtures';

const meta: Meta<typeof AppShell> = {
  title: 'Design System/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { story: { height: '640px' } } },
};
export default meta;

type Story = StoryObj<typeof AppShell>;

/**
 * Responsive multi-org shell: persistent sidebar + topbar (OrgSwitcher, search,
 * notifications, UserMenu) on desktop; bottom bar + sheet on mobile. Press ⌘K /
 * Ctrl+K (or `/`) to open the command palette.
 */
export const StaffConsole: Story = {
  render: () => {
    const [active, setActive] = useState('directory');
    return (
      <AppShell
        sidebar={<Nav active={active} onSelect={setActive} />}
        topbar={<Head />}
        bottomNav={<BottomItems active={active} onSelect={setActive} />}
        commandPalette={<CmdPalette />}
      >
        <Content />
      </AppShell>
    );
  },
};
