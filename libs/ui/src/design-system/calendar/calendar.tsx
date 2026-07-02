import type { ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../cn';
import { buttonVariants } from '../button/button';

export type CalendarProps = ComponentProps<typeof DayPicker>;

/** Calendar (shadcn/ui over react-day-picker). Token-based; used standalone or
 *  inside DatePicker. Pass `mode="single" selected onSelect` for a date field. */
export const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) => (
  <DayPicker
    showOutsideDays={showOutsideDays}
    className={cn('p-3', className)}
    classNames={{
      months: 'flex flex-col gap-2 sm:flex-row',
      month: 'flex flex-col gap-4',
      caption: 'relative flex items-center justify-center pt-1',
      caption_label: 'text-sm font-medium',
      nav: 'flex items-center gap-1',
      nav_button: cn(
        buttonVariants({ variant: 'outline' }),
        'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
      ),
      nav_button_previous: 'absolute left-1',
      nav_button_next: 'absolute right-1',
      table: 'w-full border-collapse space-y-1',
      head_row: 'flex',
      head_cell:
        'w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground',
      row: 'mt-2 flex w-full',
      cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
      day: cn(
        buttonVariants({ variant: 'ghost' }),
        'size-8 p-0 font-normal aria-selected:opacity-100',
      ),
      day_selected:
        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
      day_today: 'bg-accent text-accent-foreground',
      day_outside: 'text-muted-foreground',
      day_disabled: 'text-muted-foreground opacity-50',
      day_hidden: 'invisible',
      ...classNames,
    }}
    components={{
      IconLeft: () => <ChevronLeft className="size-4" />,
      IconRight: () => <ChevronRight className="size-4" />,
    }}
    {...props}
  />
);
