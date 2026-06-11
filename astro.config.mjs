import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Used for absolute URLs (og:image). Update if the domain changes.
  site: 'https://filipinawest.com',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});
