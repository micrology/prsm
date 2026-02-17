import * as path from 'path';
import { defineConfig } from '@rspress/core';

// Use production base path when PRSM_DEPLOY=production (for deployment to prsm.uk)
// Use development base path otherwise (for local development at localhost/prsm/)
const isProd = process.env.PRSM_DEPLOY === 'production';

export default defineConfig({
  root: path.join(__dirname, 'docs'),
  base: isProd ? '/doc/help/doc_build/' : '/prsm/doc/help/doc_build/',
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
