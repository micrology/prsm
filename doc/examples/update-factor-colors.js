/**
 * Update factor colors in a PRSM map
 * Finds all factors with a specific background color and updates them to a new color
 */

const ROOM_ID = 'VXB-BJN-TAS-YOP'
const BASE_URL = 'http://localhost:3001/api/map'
const OLD_COLOR = 'rgb(154, 219, 180)'
const NEW_COLOR = 'rgb(255, 0, 0)'

async function main() {
  try {
    console.log(`Fetching map data for room ${ROOM_ID}...`)

    // Get the map data to retrieve all factor IDs
    const mapResponse = await fetch(`${BASE_URL}/${ROOM_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!mapResponse.ok) {
      const errorData = await mapResponse.json()
      throw new Error(`HTTP ${mapResponse.status}: ${errorData.error || 'Unknown error'}`)
    }

    const mapData = await mapResponse.json()
    const factorIds = mapData.nodes.map(node => node.id).filter(id => id) // filter out any null/undefined ids

    console.log(`Found ${factorIds.length} factors in the map`)

    // Fetch details for each factor to check its background color
    const factorsToUpdate = []

    for (const factorId of factorIds) {
      console.log(`Checking factor ${factorId}...`)

      const factorResponse = await fetch(`${BASE_URL}/${ROOM_ID}/factor/${factorId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!factorResponse.ok) {
        console.warn(`Failed to fetch factor ${factorId}, skipping...`)
        continue
      }

      const factorData = await factorResponse.json()

      // Check if the background color matches the old color
      // Note: colors may have spaces after commas, so we normalize them
      const normalizeColor = (color) => color.replace(/\s+/g, '')

      if (factorData.color && factorData.color.background) {
        const currentColor = normalizeColor(factorData.color.background)
        const targetColor = normalizeColor(OLD_COLOR)

        if (currentColor === targetColor) {
          factorsToUpdate.push({
            id: factorId,
            label: factorData.label
          })
        }
      }
    }

    console.log(`\nFound ${factorsToUpdate.length} factors with background color ${OLD_COLOR}`)

    // Update each matching factor
    for (const factor of factorsToUpdate) {
      console.log(`Updating factor "${factor.label}" (${factor.id})...`)

      const updateResponse = await fetch(`${BASE_URL}/${ROOM_ID}/factor/${factor.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          update: {
            color: {
              background: NEW_COLOR
            }
          }
        })
      })

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json()
        console.error(`Failed to update factor ${factor.id}: ${errorData.error}`)
        continue
      }

      const updatedFactor = await updateResponse.json()
      console.log(`✓ Updated "${updatedFactor.label}" to ${NEW_COLOR}`)
    }

    console.log(`\nComplete! Updated ${factorsToUpdate.length} factors.`)

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
