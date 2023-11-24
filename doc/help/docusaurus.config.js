// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'PRSM',
  tagline: 'Participatory System Mapper',
  url: 'https://prsm.uk',
  //url: 'http://localhost',
  baseUrl: '/doc/help/',
  // use / when running dev server. url is irrelevant
  //baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: '/images/favicon.ico',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  //organizationName: 'facebook', // Usually your GitHub org/user name.
  //projectName: 'docusaurus', // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          /* editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/', */
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Participatory System Mapper',
        logo: {
          alt: 'PRSM Logo',
          src: '/images/PRSMlogo200.png',
          href: 'https://prsm.uk'
        },
        items: [
          {
            type: 'doc',
            docId: 'Introduction',
            position: 'left',
            label: 'User Manual',
          },
        ],
      },
      docs: {
        sidebar: {
          hideable: true,
        },
      },
      footer: {
        style: 'dark',
        links: [
          {
            label: 'Twitter',
            href: 'https://twitter.com/docusaurus',
          },
          {
            label: 'LinkedIn',
            href: 'https://www.linkedin.com/groups/8178569/',
          },
          {
            label: 'Facebook',
            href: 'https://www.facebook.com/PRSMapp',
          },
          {
            label: 'Instagram',
            href: 'https://www.instagram.com/officialprsm/',
          },
          {
            label: 'GitHub',
            href: 'https://github.com/micrology/prsm',
          }
          ],
          copyright: `Copyright <a href="https://choosealicense.com/licenses/mit/">MIT</a>© ${new Date().getFullYear()} Nigel Gilbert. Built with Docusaurus.`,
        },
        prism: {
          theme: prismThemes.github,
          darkTheme: prismThemes.dracula,
        },
    }),
};

module.exports = config;
