
const neostandard = require('neostandard')
module.exports = neostandard({
  noStyle: true,  // Disable style-related rules (useful with Prettier or dprint)
  env: ['browser', 'mocha'],  // Add browser and mocha global variables
})
