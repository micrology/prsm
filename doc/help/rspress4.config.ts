import * as path from 'path';
import { defineConfig } from '@rspress/core';

export default defineConfig({
  root: path.join(__dirname, '../help4/docs'),
  outDir: path.join(__dirname, '../help4/doc_build'),
  base: '/doc/help4/doc_build/',
  title: 'PRSM 4',
  description: 'PRSM 4 user manual (draft)',
  icon: '/images/favicon.ico',
  logo: '/images/PRSMlogo200.png',
  logoText: 'PRSM 4 Participatory System Mapper',
  globalStyles: path.join(__dirname, 'styles/index.css'),
  builderConfig: {
    resolve: {
      alias: {
        'rspress-language-tabs': path.join(__dirname, 'node_modules/rspress-language-tabs/dist/index.js'),
      },
    },
    output: { cleanDistPath: false },
  },
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
  llms: true,
});
