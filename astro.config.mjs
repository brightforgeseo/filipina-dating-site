import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  // Used for absolute URLs (og:image). Update if a custom domain replaces this.
  site: 'https://filwest.netlify.app',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});
