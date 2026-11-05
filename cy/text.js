/**
 * Divide txt into lines to make it roughly square, with a maximum width of width characters,
 * but not breaking words and respecting embedded line breaks (\n). Same rule as the original PRSM.
 * @param {string} txt
 * @param {number} [width] preferred maximum line length in characters
 * @returns {string} the split text
 */
export function splitText(txt, width = 10) {
  let lines = ''
  for (const chunk of txt.trim().split('\n')) {
    const words = chunk.trim().split(/\s/)
    const nChars = chunk.trim().length
    if (nChars > 2 * width) width = Math.floor(Math.sqrt(nChars))
    let lineLength = 0
    words.forEach((word, i) => {
      lines += word
      if (i === words.length - 1) return
      lineLength += word.length
      if (lineLength > width) {
        lines += '\n'
        lineLength = 0
      } else lines += ' '
    })
    lines += '\n'
  }
  return lines.trim()
}
