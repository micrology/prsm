import {ClassicLevel} from 'classic-level'
import {existsSync} from 'node:fs'
import {homedir} from 'node:os'

let [helpCacheLocation] = process.argv.slice(2)

if (!helpCacheLocation) {
	console.error('Usage: node listKeys.mjs <db-path>')
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

let helpCache
try {
	helpCache = new ClassicLevel(helpCacheLocation, {valueEncoding: 'json'})
	await helpCache.open()

	let count = 0
	for await (const [key, value] of helpCache.iterator()) {
		count++
		console.log(`\n--- Entry ${count} ---`)
		console.log(`KEY:   ${key}`)
		console.log(`VALUE: ${JSON.stringify(value, null, 2)}`)
	}

	if (count === 0) {
		console.log('Database is empty.')
	} else {
		console.log(`\nTotal entries: ${count}`)
	}
} catch (err) {
	if (err.code === 'LEVEL_DATABASE_NOT_OPEN') {
		const isLock = err.cause?.message?.toLowerCase().includes('lock')
		if (isLock) {
			console.error(`Database is locked by another process: ${helpCacheLocation}`)
		} else {
			console.error(`Database failed to open: ${err.cause?.message ?? err.message}`)
		}
	} else {
		console.error(`Error: ${err.message}`)
	}
	process.exitCode = 1
} finally {
	if (helpCache) {
		await helpCache.close()
	}
}
