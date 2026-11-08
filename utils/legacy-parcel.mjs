#!/usr/bin/env node

import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const [mode, ...options] = process.argv.slice(2)
if (!['build', 'watch'].includes(mode)) {
  throw new Error('Usage: node utils/legacy-parcel.mjs <build|watch> [Parcel options]')
}

const entries = readdirSync('html')
  .filter((name) => name.endsWith('.html') && !['prsm4.html', 'table4.html'].includes(name))
  .sort()
  .map((name) => `html/${name}`)

const result = spawnSync('npx', ['parcel', mode, ...entries, '--target', 'default', ...options], {
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
