import type { Preview } from '@storybook/react';
import { themes } from '@storybook/theming';
import { addons } from '@storybook/preview-api';
import { DARK_MODE_EVENT_NAME } from 'storybook-dark-mode';
import '../src/design-system/styles.css';
import '../src/design-system/themes/cyan.css';
import '../src/design-system/themes/violet.css';
import './storybook.css';

/**
 * Workbench theming controls:
 *  - Dark mode (storybook-dark-mode): one sun/moon toggle themes the manager
 *    chrome and toggles the `.dark` class on <html>, which the tokens key off.
 *  - Brand (toolbar): swaps the `.brand-*` preset class on <html> so the primary
 *    surface (button, ring, …) re-brands live — exactly how each app picks a
 *    brand. See ../src/design-system/themes/*.css.
 */
const managerBrand = {
  brandTitle: 'Acme · Design System',
  colorPrimary: '#38ddf8',
};

const BRANDS = ['cyan', 'violet'] as const;

const paintCanvas = () => {
  const root = document.documentElement;
  root.style.backgroundColor = 'var(--background)';
  root.style.color = 'var(--foreground)';
};

const applyBrand = (brand: string) => {
  const root = document.documentElement;
  root.classList.remove(...BRANDS.map((b) => `brand-${b}`));
  root.classList.add(`brand-${brand}`);
};

addons.getChannel().on(DARK_MODE_EVENT_NAME, (isDark: boolean) => {
  document.documentElement.classList.toggle('dark', isDark);
  paintCanvas();
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    // Responsive presets in the toolbar (mobile-first DS — verify all 3).
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '720px' } },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '800px' },
        },
      },
    },
    darkMode: {
      current: 'light',
      stylePreview: false,
      dark: { ...themes.dark, ...managerBrand, appBg: '#0a0a0a' },
      light: { ...themes.light, ...managerBrand },
    },
  },
  globalTypes: {
    brand: {
      description: 'Brand preset',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: [
          { value: 'cyan', title: 'Cyan' },
          { value: 'violet', title: 'Violet' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { brand: 'cyan' },
  decorators: [
    (Story, context) => {
      applyBrand(String(context.globals['brand'] || 'cyan'));
      paintCanvas();
      return Story();
    },
  ],
};

export default preview;
