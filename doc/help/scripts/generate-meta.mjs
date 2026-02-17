#!/usr/bin/env node
/**
 * Generates _meta.json for the manual directory based on the features.ai flag
 * in the root package.json. When AI is disabled, the AIAssistance page is excluded.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootPackageJson = join(__dirname, '..', '..', '..', 'package.json');
const metaJsonPath = join(__dirname, '..', 'docs', 'manual', '_meta.json');

// Read the root package.json to get the features flag
const packageJson = JSON.parse(readFileSync(rootPackageJson, 'utf-8'));
const aiEnabled = packageJson.features?.ai ?? false;

// Define the full page list
const allPages = [
  "Introduction",
  "Examples",
  "GettingStarted",
  "Mouse",
  "Styling",
  "Drawing",
  "AIAssistance",
  "DataView",
  "Files",
  "Cloning",
  "Analysing",
  {
    "type": "dir",
    "name": "Advanced",
    "label": "Advanced",
    "collapsible?": true,
    "collapsed": false
  },
  "Acknowledgements",
  "ReleaseNotes"
];

// Filter out AIAssistance if AI is disabled
const pages = aiEnabled 
  ? allPages 
  : allPages.filter(page => page !== "AIAssistance");

// Write the _meta.json
writeFileSync(metaJsonPath, JSON.stringify(pages, null, 2) + '\n');

console.log(`Generated _meta.json (AI features: ${aiEnabled ? 'enabled' : 'disabled'})`);
