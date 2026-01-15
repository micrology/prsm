/********************************************************************************************* 

PRSM Participatory System Mapper 

MIT License

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


This module generates responses using an LLM.  
********************************************************************************************/

import markdownToDelta from 'markdown-to-quill-delta'
import { room, debug } from './prsm.js'

// Function to send a message to the AI and get a response
async function chat(userMessage, systemPrompt = null) {
  try {
    // Backend API endpoint
    let API_ENDPOINT = 'https://cress.soc.surrey.ac.uk/api/chat'
    if (/local/.test(debug)) {
      console.log('Using LOCAL AI API endpoint')
      API_ENDPOINT = 'http://localhost:3001/api/chat'
    }
    if (/prompt/.test(debug)) {
      console.log('System Prompt:', systemPrompt)
      console.log('User Message:', userMessage)
    }
    // Call backend proxy API
    const response = await fetch(`${API_ENDPOINT}/${room}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        systemPrompt
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.response
  } catch (err) {
    console.log(`ERROR: ${err.message}`)
    return `# Error: ${err.message}`
  }
}

export async function getAIresponse(userMessage, systemPrompt) {
  const markdown = await chat(userMessage, systemPrompt)
  return markdownToDelta(markdown)
}
