#!/usr/bin/env node
/**
 * Build frontend (and help) assets for the Docker httpd image with AI disabled.
 *
 * Temporarily sets package.json features.ai to false for the Parcel build so the
 * published container does not expose API-dependent AI UI, then restores the
 * original package.json (even if the build fails).
 *
 * Usage (from repo root):
 *   node utils/build-for-docker.mjs
 *   npm run build-for-docker
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json')

/**
 * Run an npm script in the repo root; exit on failure.
 * @param {string} script
 */
function runNpm(script) {
  console.log(`\n> npm run ${script}`)
  const result = spawnSync('npm', ['run', script], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with exit code ${result.status}`)
  }
}

const originalPackageJson = fs.readFileSync(PACKAGE_JSON, 'utf8')
const pkg = JSON.parse(originalPackageJson)
const previousAi = pkg.features?.ai

try {
  if (!pkg.features) pkg.features = {}
  pkg.features.ai = false
  fs.writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log(
    `build-for-docker: features.ai ${JSON.stringify(previousAi)} → false (temporary)`
  )

  // httpd image ships dist/ and the built user manual
  runNpm('build')
  runNpm('build-help')

  console.log('build-for-docker: frontend and help assets ready for Docker')
} finally {
  fs.writeFileSync(PACKAGE_JSON, originalPackageJson)
  console.log(
    `build-for-docker: restored package.json features.ai to ${JSON.stringify(previousAi)}`
  )
}
