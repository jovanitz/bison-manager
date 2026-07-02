import type { Meta, StoryObj } from '@storybook/react';
import { LayoutDashboard, Users, ShieldCheck, Menu } from 'lucide-react';
import { BottomNav, BottomNavItem } from './bottom-nav';

const meta: Meta<typeof BottomNav> = {
  title: 'Design System/BottomNav',
  component: BottomNav,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof BottomNav>;

export const Default: Story = {
  render: () => (
    <div className="w-96 max-w-full">
      <BottomNav>
        <BottomNavItem icon={<LayoutDashboard />} active>
          Overview
        </BottomNavItem>
        <BottomNavItem icon={<Users />}>Directory</BottomNavItem>
        <BottomNavItem icon={<ShieldCheck />}>Access</BottomNavItem>
        <BottomNavItem icon={<Menu />}>More</BottomNavItem>
      </BottomNav>
    </div>
  ),
};
