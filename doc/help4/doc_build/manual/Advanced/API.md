> For AI agents: the complete documentation index is available at /doc/help4/doc_build/llms.txt, the full documentation bundle is available at /doc/help4/doc_build/llms-full.txt.

# Interfacing with PRSM (API)

:::warning Draft
This page has not yet been fully revised for PRSM 4 and may describe the legacy app. See the [PRSM 4 overview](/doc/help4/doc_build/manual/Introduction.md) for current guidance.
:::

## Overview

PRSM provides an API (Application Programming Interface) for other programs so that they can read and modify maps. This is done by accessing specific web addresses (called 'endpoints') with parameters that state what operation is to be carried out.

## Base URL

All the endpoints are based on the following web address - see below for the actual endpoints.

```text
https://prsm.uk/api/map
```

## Authentication

All API accesses have to be accompanied by the room ID of the map to be accessed or modified. This map _must already exist_, having previously been created in the PRSM web app.  See [Sharing](/doc/help4/doc_build/manual/GettingStarted.md#sharing) for how to find the ID of a map.

## Rate limiting

To prevent malicious use, if calls from an IP address arrive at a rate of more than 20 per second, the excess will be rejected with a message and HTTP status `503`.  It is recommended that API calls are separated by calls to a `sleep` function that pauses the calling program for about 100 milliseconds between API accesses.

## Returned values

All the API endpoints return a [JSON](https://www.json.org/json-en.html) formatted string.  This will either be the retrieved data, or an error message.  The format of the retrieved data varies according to the endpoint, but the error messages are in a standard format, such as:

```bash
{"error":"Map not found"}
```

In addition, the response includes a status code:

- `200` - Success
- `404` - Not found
- `500` - Server error
- `503` - Rate limit exceeded

## A simple example

To get a list of the factors and links in a map with the room ID `ABC-DEF-GHI-JKL`, one would use the web address:

```text
https://prsm.uk/api/map/ABC-DEF-GHI-JKL
```

Normally this web address would be accessed from code inside a program or from the command line.  The program can be written in any suitable language such as JavaScript, Python or PHP.  For example, this snippet returns data about the map as a JSON string in the `data` variable (click on the tabs for samples in each language):


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


## Modifying Factors and Links

When you want to modify a factor or link (for example, changing the colour of a factor), you send the changes to the API using a PATCH request. The request body must contain an `update` object with the properties you want to change. These properties will overwrite the existing values.

For example, to change a specific factor's background colour to red and increase its border width to 4 pixels, you would send the following PATCH request to `/api/map/{roomID}/factor/{factorID}`:


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL/factor/86db33bf-0b88-45da-a829-7c777d9bf4ba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        update: {color: {background: 'rgb(255,0,0)'}, borderWidth: 4 }
      }),
      })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL/factor/86db33bf-0b88-45da-a829-7c777d9bf4ba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        update: {color: {background: 'rgb(255,0,0)'}, borderWidth: 4 }
      }),
      })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL/factor/86db33bf-0b88-45da-a829-7c777d9bf4ba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        update: {color: {background: 'rgb(255,0,0)'}, borderWidth: 4 }
      }),
      })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


**undefined**

```javascript
const response = await fetch(`https://prsm.uk/api/map/ABC-DEF-GHI-JKL/factor/86db33bf-0b88-45da-a829-7c777d9bf4ba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        update: {color: {background: 'rgb(255,0,0)'}, borderWidth: 4 }
      }),
      })
if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }
const data = await response.json()
```


:::tip

If you want to create a new factor or link with a specific design programmatically, it is helpful first to create a factor or link with that design by hand on a map and then use the `GET factor` endpoint to retrieve its details.  You can then use this as a template to create new similar factors or links programmatically.

:::

:::info

What this manual refers to as `style` is called internally, `grp`.  And the name of a style is called its `groupLabel`.

:::

## Attributes

Arbitrary variables may be attached to both factors and links.  These are called `attributes` and they can be created, viewed and their values edited in the [Data View](/doc/help4/doc_build/manual/DataView.md#Managing_the_whole_table).  Attributes have a title (the name that is shown at the top of their column in the Data View) and an internal name of the form `attX`, where `X` is a number, e.g. `att1`.

If there are any attributes defined for a factor or a link, the internal name and the attribute value will be returned when getting the details using the `GET factor` or `GET link` endpoints.  For example, the JSON returned might include `"att1":"female"`.  The JSON returned by the `GET map information` endpoint will include a property, `attributeTitles`, whose value is an object associating each of the internal attribute names with their external titles, e.g. `"attributeTitles":{"att1":"Gender"}`.

## Endpoints

### Get map information

`GET https://prsm.uk/api/map{roomID}`

**Description:**

Returns data about the map as a whole.

**Parameters:**

- `roomID`: The room identifier for the map

**Response:**

Returns a JSON string of an object with the properties:

- room: the roomID
- title: the title of the map, if any
- viewOnly:  `true` if the map cannot be altered by the user (NB: even if true, the map can still be altered through the API)
- version: the version number of PRSM used to create the map
- backgroundColor: the color of the map background
- nodes: an array of the factors in the map.  Each consists of an object with properties:
  - id: a unique identifier for the factor
  - label: the label of the factor (the text that is visible on the factor)
  - x, y : the position of the factor on the underlying canvas (this does not change even if the map is scrolled around the viewport)
- edges: an array of the links in the map.   Each consists of an object with properties:
  - id: a unique identifier for the link
  - label: the label of the link, if any
  - from: the id of the factor that the link points away from
  - to: the id of the factor that the link points to

**Example output:**

```json
{"room":"ABC-DEF-GHI-JKL",
"title":"An example map",
"version":"3.0.3",
"nodes":[{},{"id":"86db33bf-0b88-45da-a829-7c777d9bf4ba","label":"test for notes","x":-46,"y":-131},{"id":"87b4444e-233c-4ce8-9a39-4f629c1ff43a","label":"Another factor","x":145,"y":-32}],
"edges":[{},{"id":"6a12f9f4-3e84-4888-8b13-5f7023e3024e","from":"86db33bf-0b88-45da-a829-7c777d9bf4ba","to":"87b4444e-233c-4ce8-9a39-4f629c1ff43a"}]}
```

### Update a map's title and background

`PATCH https://prsm.uk/api/map/{roomID}`

**Description:**

Updates the title and/or background colour of the map.

**Parameters:**

- `roomID`: The room identifier for the map

**Request Body:**

The body must include an `update` object with the properties to update: the new map title, the new background colour, or both.

**Example request body:**

```json
{
  "update": {
    "title": "New title",
    "background": "rgb(255,0,0)",
  }
}
```

**Response:**

Returns a JSON string of an object with the new title and background properties.

### Get the details of a factor

`GET https://prsm.uk/api/map{roomID}/factor/{factorID}`

**Description:**

Returns full details about a specific factor in the map.

**Parameters:**

- `roomID`: The room identifier for the map
- `factorID`: The unique identifier for the factor

**Response:**

Returns a JSON string of an object with the properties:

- id: a unique identifier for the factor
- label: the label of the factor (the text that is visible on the factor)
- x, y: the position of the factor on the underlying canvas
- borderWidth: the width of the factor's border
- color: an object containing color settings:
  - border: the border color
  - background: the background color
  - highlight: highlight colors (border and background)
  - hover: hover colors (border and background)
- created: an object with time (timestamp) and user properties
- modified: an object with time (timestamp) and user properties
- note: an object in \[[https://quilljs.com/docs/delta/\](Quill](https://quilljs.com/docs/delta/]\(Quill) Delta) format that describes the Note associated with this factor
- groupLabel: the label of the group this factor belongs to, if any
- grp: the group number
- font: an object with font settings (face, color, size)
- shape: the shape of the factor (e.g., "box", "ellipse")
- shapeProperties: additional shape-specific properties

**Example output:**

```json
{"id":"86db33bf-0b88-45da-a829-7c777d9bf4ba",
"label":"test label",
"note":{"ops":[{"insert":"THIS IS A NOTE\n"}]},
"x":-46,
"y":-131,
"grp": "group0",
"borderWidth":1,
"color": {
    "border": "rgb(154, 219, 180)",
    "background": "rgb(154, 219, 180)",
    "highlight": {
        "border": "rgb(154, 219, 180)",
        "background": "rgb(154, 219, 180)"
    },
    "hover": {
        "border": "rgb(154, 219, 180)",
        "background": "rgb(154, 219, 180)"
    }
},
"font": {
    "face": "Oxygen",
    "color": "rgb(0, 0, 0)",
    "size": 14
},
"borderWidth": 0,
"shape": "box",
"shapeProperties": {
    "borderDashes": false
},
"groupLabel": "Sample",
"created":{"time":1640000000000,"user":"john@example.com"},
"modified":{"time":1640000000000,"user":"john@example.com"}}
```

### Update the details of a factor

`PATCH https://prsm.uk/api/map{roomID}/factor/{factorID}`

**Description:**

Updates properties of a specific factor.

**Parameters:**

- `roomID`: The room identifier for the map
- `factorID`: The unique identifier for the factor

**Request Body:**

The body must include an `update` object with the properties to update. Any property from the factor can be updated (label, color, position, etc.).

**Example request body:**

```json
{
  "update": {
    "label": "Updated label",
    "color": {"background": "rgb(255,0,0)"},
    "borderWidth": 2
  }
}
```

**Response:**

Returns the updated factor object with all its properties (same format as GET /map/\{roomID}/factor/\{factorID}).

### Add a new factor

`POST https://prsm.uk/api/map{roomID}/factor/{factorID}`

**Description:**

Creates a new factor with the specified properties.

**Parameters:**

- `roomID`: The room identifier for the map
- `factorID`: The unique identifier for the new factor (should be a UUID)

**Request Body:**

The body must include a `spec` object with the factor properties. The only required property is `label`. All other properties have defaults:

- label (required): the text to display on the factor
- x, y (default: 0, 0): position on the canvas
- borderWidth (default: 0): width of the border
- color (default: green): color settings object
- font (default: Oxygen, 14pt, black): font settings object
- note: (default: balnk): object in \[[https://quilljs.com/docs/delta/\](Quill](https://quilljs.com/docs/delta/]\(Quill) Delta) format describing a note
- grp (default: 0): group number
- shape (default: "box"): the shape of the factor
- shapeProperties (default: {}): additional shape properties

**Response:**

Returns the created factor object with all its properties.

**Example request body:**

```json
{
  "spec": {
    "label": "New Factor",
    "x": 100,
    "y": 200,
    "color": {"background": "rgb(200,200,255)"}
  }
}
```

### Delete a factor

`DELETE https://prsm.uk/api/map{roomID}/factor/{factorID}`

**Description:**

Deletes a specific factor and all links connected to it.

**Parameters:**

- `roomID`: The room identifier for the map
- `factorID`: The unique identifier for the factor

**Response:**

Returns a success message.

**Example output:**

```json
{"message": "Factor deleted"}
```

### Get details about a link

`GET https://prsm.uk/api/map{roomID}/link/{linkID}`

**Description:**

Returns full details about a specific link in the map.

**Parameters:**

- `roomID`: The room identifier for the map
- `linkID`: The unique identifier for the link

**Response:**

Returns a JSON string of an object with the properties:

- id: a unique identifier for the link
- label: the label of the link, if any
- from: the id of the factor that the link points away from
- to: the id of the factor that the link points to
- arrows: an object describing arrow configuration:
  - to: arrow at the "to" end (enabled, type)
  - middle: arrow in the middle (enabled)
  - from: arrow at the "from" end (enabled)
- width: the width of the link line
- dashes: whether the link is dashed (true/false)
- note: an object in \[[https://quilljs.com/docs/delta/\](Quill](https://quilljs.com/docs/delta/]\(Quill) Delta) format that describes the Note associated with this link
- color: an object containing color settings (color, highlight, hover)
- created: an object with time (timestamp) and user properties
- modified: an object with time (timestamp) and user properties
- groupLabel: the label of the group this link belongs to, if any
- grp: the group number
- font: an object with font settings (face, color, size)

**Example output:**

```json
{"id":"860a240b-15d5-4d99-bc69-f1a3d01391c4",
"label":" ","from":"8d3bf8b9-ff59-45e3-b7d9-86fffd801327",
"note":{"ops":[{"insert":"THIS IS A NOTE FOR A LINK\n"}]},
"to":"501086d4-eaba-4ff1-ab8a-35295bd0310f",
"arrows":{"to":{"enabled":true,"type":"vee"},"middle":{"enabled":false},"from":{"enabled":false}},
"width":1,
"dashes":false,
"color":{"color":"rgb(255,0,255)"},
"created":{"time":1732706793944,"user":"john@example.com"},
"modified":{"time":1768508302550,"user":"john@example.com"},
"groupLabel":"Complex",
"grp":"edge0",
"font":{"size":14,"align":"top","background":"rgb(255,255,255)","color":"rgba(0,0,0,1)"}}
```

### Update details about a link

`PATCH https://prsm.uk/api/map{roomID}/link/{linkID}`

**Description:**

Updates properties of a specific link.

**Parameters:**

- `roomID`: The room identifier for the map
- `linkID`: The unique identifier for the link

**Request Body:**

The body must include an `update` object with the properties to update. Any property from the link can be updated (label, color, arrows, width, dashes, etc.).

**Response:**

Returns the updated link object with all its properties (same format as GET /map/\{roomID}/link/\{linkID}).

**Example request:**

```json
{
  "update": {
    "label": "influences",
    "width": 3,
    "dashes": true
  }
}
```

**Example output:**

```json
{"node":{"groupLabel":"Sample","borderWidth":0,"borderWidthSelected":4,"color":{"background":"rgb(255,0,255)"},"fixed":false,"font":{"face":"Oxygen","color":"rgb(0, 0, 0)","size":14},"labelHighlightBold":true,"margin":20,"shape":"box","shapeProperties":{"borderDashes":false},"scaling":{"min":10,"max":40,"label":{"enabled":false,"min":10,"max":40}},"size":25,"heightConstraint":false,"widthConstraint":false}}
```

### Add a new link

`POST https://prsm.uk/api/map{roomID}/link/{linkID}`

**Description:**

Creates a new link with the specified properties.

**Parameters:**

- `roomID`: The room identifier for the map
- `linkID`: The unique identifier for the new link (should be a UUID)

**Request Body:**

The body must include a `spec` object with the link properties. Required properties are `from` and `to` (factor IDs). All other properties have defaults:

- from (required): the id of the source factor
- to (required): the id of the target factor
- label (optional): text to display on the link
- color (default: black): color settings object
- font (default: Oxygen, 14pt, black): font settings object
- grp (default: 0): group number
- arrows (default: "to" arrow enabled): arrow configuration
- dashes (default: false): whether the link is dashed
- width (optional): width of the link line

**Response:**

Returns the created link object with all its properties. Returns an error if either the `from` or `to` factor does not exist.

**Example request:**

```json
{
  "spec": {
    "from": "86db33bf-0b88-45da-a829-7c777d9bf4ba",
    "to": "87b4444e-233c-4ce8-9a39-4f629c1ff43a",
    "label": "leads to"
  }
}
```

### Delete a link

`DELETE https://prsm.uk/api/map{roomID}/link/{linkID}`

**Description:**

Deletes a specific link.

**Parameters:**

- `roomID`: The room identifier for the map
- `linkID`: The unique identifier for the link

**Response:**

Returns a success message.

**Example output:**

```json
{"message": "Link deleted"}
```

### Get a list of all styles

`GET https://prsm.uk/api/map/{roomID}styles`

**Description:**

Returns details about all the styles (factor styles and link styles), as shown in the Settings panel.

**Parameters:**

- `roomID`: The room identifier for the map

**Response:**

Returns a JSON string of an Array of Arrays.  Each sub-array has one element that is the `grp` (e.g. `group0`, `group1` ... `group14` for factor styles and `edge0` ... `edge8` for link styles) and a second element that is an object describing the style.  For the properties of these objects, see the descriptions of factor and link properties above.

For example, the following shows the first few lines returned from the default styles as they appear when you start a new map.

```json
[
  [
    "group0",
    {
      "node": {
        "groupLabel": "Sample",
        "borderWidth": 0,
        "borderWidthSelected": 4,
        "color": {
          "border": "rgb(154, 219, 180)",
          "background": "rgb(219, 11, 0)",
          "highlight": {
            "border": "rgb(154, 219, 180)",
            "background": "rgb(219, 11, 0)"
          },
```

### Get details of a style

`GET https://prsm.uk/api/map/{roomID}styles/{styleID}`

**Description:**

Returns details about a style.

**Parameters:**

- `roomID`: The room identifier for the map
- `styleID`: The identifier (`grp`) of the style

**Response:**

Returns a JSON string of an Array with one element that is the `grp` (e.g. `group0`, `group1` ... `group14` for factor styles and `edge0` ... `edge8` for link styles) and a second element that is an object describing the style.  For the properties of these objects, see the descriptions of factor and link properties above.

**Example:**

The following shows what is returned from the default styles for the factor style, `group0`.

````json
["group0",{"node":{"groupLabel":"Sample","borderWidth":0,
"borderWidthSelected":4,"color":{
"border":"rgb(154, 219, 180)","background":"rgb(154, 219, 180)"},
"highlight":{"border":"rgb(154, 219, 180)","background":"rgb(154, 219, 180)"},
"hover":{"border":"rgb(154, 219, 180)","background":"rgb(154, 219, 180)"}},
"fixed":false,
"font":{"face":"Oxygen","color":"rgb(0, 0, 0)","size":14},
"labelHighlightBold":true,"margin":20,"shape":"box",
"shapeProperties":{"borderDashes":false},
"scaling":{"min":10,"max":40,"label":{"enabled":false,"min":10,"max":40}},
"size":25,"heightConstraint":false,"widthConstraint":false}}]```
````

### Update a style

`PATCH https://prsm.uk/api/map/{roomID}styles/{styleID}`

**Description:**

Updates details about a style.

**Parameters:**

- `roomID`: The room identifier for the map
- `styleID`: The identifier (`grp`) of the style

**Request Body:**

The body must include an `update` object with the properties to update. Any property from the style can be updated (groupName, color, arrows, width, dashes, etc.).  For example, `{"update": {"color": {"background": "rgb(255,0,0)"}}}`

**Response:**

Returns a JSON string of an object describing the style.  For the properties of these objects, see the descriptions of factor and link properties above.

**Example:**

The following shows what is returned from the default styles for the factor style, `group0` after updating the background colour to red (`rgb(255,0,0)`).

```json
{"node":{"groupLabel":"Sample","borderWidth":0,"borderWidthSelected":4,
"color":{"background":"rgb(255,0,0)"},"fixed":false,
"font":{"face":"Oxygen","color":"rgb(0, 0, 0)","size":14},
"labelHighlightBold":true,"margin":20,"shape":"box",
"shapeProperties":{"borderDashes":false},
"scaling":{"min":10,"max":40,"label":{"enabled":false,"min":10,"max":40}},
"size":25,"heightConstraint":false,"widthConstraint":false}}
```

## Example

To show how one might put these endpoints together, the following complete program changes the background of all the factors that are the standard green (in fact, the colour 'rgb(154, 219, 180)') to red ('rgb(255, 0, 0)').  It first obtains a list of all factors, then examines each one to test its background colour, and then if the colour is green, changes it to red.



**undefined**

```javascript
/**
 * Update factor colors in a PRSM map
 * Finds all factors with a specific background color and updates them to a new color
 */

const ROOM_ID = 'ABC-DEF-GHI-JKL'
const BASE_URL = 'https://prsm.uk/api/map'
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
```


**undefined**

```javascript
/**
 * Update factor colors in a PRSM map
 * Finds all factors with a specific background color and updates them to a new color
 */

const ROOM_ID = 'ABC-DEF-GHI-JKL'
const BASE_URL = 'https://prsm.uk/api/map'
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
```


**undefined**

```javascript
/**
 * Update factor colors in a PRSM map
 * Finds all factors with a specific background color and updates them to a new color
 */

const ROOM_ID = 'ABC-DEF-GHI-JKL'
const BASE_URL = 'https://prsm.uk/api/map'
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
```


