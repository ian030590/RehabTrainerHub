import type { Config } from 'tailwindcss';
import { rehabTheme } from './tokens';

const config: Config = {
  content: [
    '../../apps/**/*.{ts,tsx,js,jsx}',
    '../../packages/ui/src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: rehabTheme.colors,
      borderRadius: rehabTheme.radius,
      fontFamily: rehabTheme.fontFamily,
    },
  },
};

export default config;
