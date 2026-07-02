import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Design System/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Directory: Story = {
  render: () => (
    <Tabs defaultValue="staff" className="w-96">
      <TabsList>
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
        <TabsTrigger value="orphans">Orphans</TabsTrigger>
      </TabsList>
      <TabsContent value="staff" className="text-sm text-muted-foreground">
        Staff accounts, read-only.
      </TabsContent>
      <TabsContent value="customers" className="text-sm text-muted-foreground">
        Customer organizations.
      </TabsContent>
      <TabsContent value="orphans" className="text-sm text-muted-foreground">
        Identities with no organization.
      </TabsContent>
    </Tabs>
  ),
};
