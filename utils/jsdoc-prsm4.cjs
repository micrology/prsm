/**
 * Translate TypeScript-style JSDoc type expressions into syntax understood by
 * JSDoc 4, without changing the source annotations used by editors.
 */
exports.handlers = {
  beforeParse(event) {
    event.source = event.source.replace(/\/\*\*[\s\S]*?\*\//g, (comment) =>
      comment
        .replace(/import\(['"][^'"]+['"]\)\.([A-Za-z_$][\w$]*)/g, '$1')
        .replace(/Array<\[string, object\]>/g, 'Array<Array<(string|object)>>')
        .replace(/Array<\[number, object\]>/g, 'Array<Array<(number|object)>>')
        .replace(
          /\b([A-Za-z_$][\w$]*)\?:\s*(Set<string>|function\([^)]*\):void|function\(\):boolean|boolean|number)/g,
          '$1: ($2|undefined)'
        )
        .replace(/leverage:number\|null/g, 'leverage:(number|null)')
        .replace(/function\(string\|number\)/g, 'function((string|number))')
        .replace(/\{1\|-1\}/g, '{number}')
    )
  },
}
