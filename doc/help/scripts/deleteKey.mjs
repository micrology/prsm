import { ClassicLevel } from 'classic-level'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

let [helpCacheLocation, key] = process.argv.slice(2)

if (!helpCacheLocation || !key) {
  console.error('Usage: node deleteKey.mjs <db-path> <key>')
  process.exit(1)
}

// Expand leading ~ to home directory
if (helpCacheLocation.startsWith('~')) {
  helpCacheLocation = helpCacheLocation.replace('~', homedir())
}

if (!existsSync(helpCacheLocation)) {
  console.error(`Database path does not exist: ${helpCacheLocation}`)
  process.exit(1)
}

if (key.trim().length === 0) {
  console.error('Key must be a non-empty string')
  process.exit(1)
}
let helpCache
try {
  helpCache = new ClassicLevel(helpCacheLocation, { valueEncoding: 'json' })
  await helpCache.open()

  // Verify the key exists before deleting
  const value = await helpCache.get(key)
  if (value === undefined) {
    console.error(`Key "${key}" not found in database`)
    process.exitCode = 1
  } else {
    await helpCache.del(key)

    // Confirm deletion within the same session
    const check = await helpCache.get(key)
    if (check === undefined) {
      console.log(`Deleted key: "${key}"`)
    } else {
      console.error(`Key "${key}" still present after deletion`)
      process.exitCode = 1
    }
  }
} catch (err) {
  if (err.code === 'LEVEL_LOCKED') {
    console.error(`Database is locked by another process: ${helpCacheLocation}`)
  } else {
    console.error(`Error: ${err.message}`)
  }
  process.exitCode = 1
} finally {
  if (helpCache) {
    await helpCache.close()
  }
}
