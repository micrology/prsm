module.exports = {
    "env": {
        "browser": true,
        "es6": true,
	"amd": true,
	"node": true
    },
    "extends": [
	"eslint:recommended",
	"prettier"
	],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2021,
        "sourceType": "module"
    },
    "rules": {
    }
};
