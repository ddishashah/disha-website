import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// The blog is fully static and is merged into the main site at deploy time (see ../scripts/build.sh).
// The only server code is the editor's sign-in API, which lives in ../functions (Cloudflare Pages Functions).
export default defineConfig({
  site: 'https://disha-shah.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [react()],
});
