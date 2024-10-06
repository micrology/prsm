import * as path from 'path';
import { defineConfig } from 'rspress/config';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: '/prsm/doc/help/doc_build/',
  title: 'PRSM',
  description: 'User Manual',
  icon: '/images/favicon.ico',
  logo: '/images/PRSMlogo200.png',
  logoText: 'PRSM Participatory System Mapper',
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/micrology/prsm/issues' },
    ],
  },
});
