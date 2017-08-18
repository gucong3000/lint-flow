const yargs = require('yargs')
const pkg = require('../package.json')
const isPreCommit = true

function splitArgv (argv) {
	let mainArgv = []
	let currSubArgv = mainArgv
	const command = {}
	argv.forEach(argv => {
		if (/^(csslint|editorconfig|eslint|htmlhint|jscs|jshint|standard|stylelint|tslint|xo)$/i.test(argv)) {
			currSubArgv = []
			command[argv.toLowerCase()] = currSubArgv
		} else {
			currSubArgv.push(argv)
		}
	})
	mainArgv = yargs(mainArgv).argv

	// console.log(config)
	Object.keys(command).forEach(key => (
		command[key] = yargs(command[key]).argv
	))
	console.log(mainArgv)
	console.log(command)
}

module.exports = splitArgv
