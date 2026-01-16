import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: '/prsm/doc/help/doc_build/',
  title: 'PRSM',
  description: 'User Manual',
  icon: '/images/favicon.ico',
  logo: '/images/PRSMlogo200.png',
  logoText: 'PRSM Participatory System Mapper',
  globalStyles: path.join(__dirname, 'styles/index.css'),
  markdown: {
    shiki: {
      langs: ['javascript', 'typescript', 'json', 'bash', 'yaml', 'php'],
    },
  },
  themeConfig: {
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/micrology/prsm/issues' },
    ],
    
  },
});
