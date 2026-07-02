import type { Meta, StoryObj } from '@storybook/react';
import {
  Sparkles,
  Bot,
  Boxes,
  Wrench,
  Phone,
  FlaskConical,
  AlertTriangle,
  Bell,
  Activity,
  ScrollText,
  Search,
  ArrowUp,
} from 'lucide-react';
import { cn } from '../cn';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNav,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar';
import {
  SidebarCollapsible,
  SidebarMenuButton,
  SidebarNavItem,
} from './sidebar-nav';
import { SidebarProvider, useSidebar } from './sidebar-context';
import { Badge } from '../badge/badge';
import { Input } from '../input/input';
import { Button } from '../button/button';

const meta: Meta<typeof Sidebar> = {
  title: 'Design System/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { story: { height: '620px' } } },
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

const tag = 'h-4 border-transparent px-1.5 text-[10px] font-medium';

const Head = () => {
  const { railed } = useSidebar();
  return (
    <SidebarHeader>
      {!railed && (
        <>
          <Sparkles className="size-5 shrink-0 text-primary" />
          <span className="flex-1 truncate">Acme Labs</span>
        </>
      )}
      <SidebarTrigger />
    </SidebarHeader>
  );
};

const Top = () => {
  const { railed } = useSidebar();
  return (
    <div
      className={cn('flex flex-col gap-2 px-2 pt-2', railed && 'items-center')}
    >
      <SidebarMenuButton avatar="A" label="Acme Inc" sublabel="Pro plan" />
      {!railed && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search…" className="h-9 pl-8 pr-10" />
          <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 items-center rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </div>
      )}
    </div>
  );
};

const Nav = () => (
  <SidebarContent>
    <SidebarGroupLabel>Labs</SidebarGroupLabel>
    <SidebarNav>
      <SidebarNavItem
        icon={<Sparkles />}
        badge={
          <Badge className={`bg-primary/15 text-primary ${tag}`}>Alpha</Badge>
        }
      >
        Composer
      </SidebarNavItem>
    </SidebarNav>

    <SidebarGroupLabel>Build</SidebarGroupLabel>
    <SidebarNav>
      <SidebarNavItem icon={<Bot />}>Assistants</SidebarNavItem>
      <SidebarNavItem icon={<Boxes />}>Squads</SidebarNavItem>
      <SidebarNavItem icon={<Wrench />}>Tools</SidebarNavItem>
      <SidebarNavItem icon={<Phone />}>Phone Numbers</SidebarNavItem>
    </SidebarNav>

    <SidebarGroupLabel>Test</SidebarGroupLabel>
    <SidebarNav>
      <SidebarNavItem icon={<FlaskConical />}>Test Suites</SidebarNavItem>
      <SidebarNavItem
        icon={<Activity />}
        badge={
          <Badge variant="secondary" className={tag}>
            Beta
          </Badge>
        }
      >
        Evals
      </SidebarNavItem>
    </SidebarNav>

    <SidebarGroupLabel>Observe</SidebarGroupLabel>
    <SidebarNav>
      <SidebarCollapsible
        icon={<AlertTriangle />}
        label="Issues"
        active
        defaultOpen
      >
        <SidebarNavItem icon={<Activity />}>Monitors</SidebarNavItem>
        <SidebarNavItem icon={<Bell />}>Notifiers</SidebarNavItem>
      </SidebarCollapsible>
      <SidebarNavItem icon={<ScrollText />}>Call Logs</SidebarNavItem>
    </SidebarNav>
  </SidebarContent>
);

const Foot = () => {
  const { railed } = useSidebar();
  if (railed) {
    return (
      <SidebarFooter className="flex justify-center">
        <Button variant="outline" size="icon" aria-label="Buy credits">
          <ArrowUp />
        </Button>
      </SidebarFooter>
    );
  }
  return (
    <SidebarFooter>
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>PAYG</span>
        <span className="font-medium text-foreground">16.43 credits</span>
      </div>
      <Button variant="outline" size="sm" className="w-full">
        <ArrowUp />
        Buy credits
      </Button>
    </SidebarFooter>
  );
};

export const Console: Story = {
  render: () => (
    <div className="h-screen">
      <SidebarProvider>
        <Sidebar>
          <Head />
          <Top />
          <SidebarSeparator className="mx-2 mt-2" />
          <Nav />
          <Foot />
        </Sidebar>
      </SidebarProvider>
    </div>
  ),
};
