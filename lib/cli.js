const pkg = require('../package.json')
const flow = require('./flow')
const yargs = require('yargs')
const fs = require('fs-extra')
const path = require('path')
const Module = require('module')
const isCI = require('is-ci')

function splitArgv (argv) {
	let mainArgv = []
	let currSubArgv = mainArgv
	const linters = {}
	argv.forEach(argv => {
		if (/^(eclint|eslint|htmlhint|standard|stylelint|tslint|xo)$/i.test(argv)) {
			currSubArgv = []
			linters[argv.toLowerCase()] = currSubArgv
		} else {
			currSubArgv.push(argv)
		}
	})
	mainArgv = yargs(mainArgv)
		.usage('Usage: $0 command globs... [options]')
		.options('staged', {
			describe: 'lint code that staged',
			type: 'boolean',
		})
		.options('changed', {
			describe: 'lint code that changed',
			type: 'boolean',
		})
		.options('diff-with', {
			describe: 'lint code that diff with master or config branch',
		})
		.options('fix', {
			describe: 'Automatically fix code',
			type: 'boolean',
			default: !isCI,
		})
		.options('cwd', {
			describe: 'working directory',
			type: 'string',
			default: process.cwd(),
		})
		.options('debug', {
			describe: 'Show debug info in console',
			type: 'boolean',
			default: false,
		})
		.help()
		.version(pkg.version)
		.argv

	Object.keys(linters).forEach(linter => {
		linters[linter] = yargs(linters[linter]).argv
	})

	return fs.readJSON(path.join(mainArgv.cwd, 'package.json')).then(pkj => {
		if (!(pkj && (pkj.dependencies || pkj.devDependencies))) {
			return
		}
		const paths = Module._nodeModulePaths(mainArgv.cwd)
		const moduleNames = [
			[
				'standard',
				'xo',
				'eslint',
				'jshint',
			],
			[
				'jscs',
			],
			[
				'tslint',
			],
			[

				'csslint',
				'stylelint',
			],
			[
				'htmlhint',
			],
			[
				'eclint',
			],
		]
		moduleNames.forEach(moduleNames => {
			moduleNames.some(linter => {
				if (linter in linters) {
					if (linters[linter]) {
						linters[linter].$0 = Module._findPath(linter, paths)
					}
				} else if ((linter in pkj.devDependencies) || (linter in pkj.dependencies)) {
					linters[linter] = {
						_: [],
						$0: Module._findPath(linter, paths),
					}
				} else {
					return false
				}
				return true
			})
		})
	}).catch(() => {

	}).then(() => {
		return flow(mainArgv, linters)
	}).catch(error => {
		process.exitCode = 1
		if (error.plugin === 'gulp-reporter') {
			console.error(String(error))
		} else {
			console.error(error)
		}
	})
}

module.exports = splitArgv
process.on('unhandledRejection', error => {
	console.error(error)
	process.exit(1)
})
