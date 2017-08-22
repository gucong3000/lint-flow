const pkg = require('../package.json')
const flow = require('./flow')
const yargs = require('yargs')
const fs = require('fs-extra')
const path = require('path')
const Module = require('module')
const isCI = require('is-ci')

const globs = {
	stylelint: [
		'**/*.{css,sass,scss,less,sss,vue,htm,html,md}',
	],
	tslint: [
		'**/*.ts',
	],
	eslint: [
		'**/*.{js,es6,jsx}',
	],
	htmlhint: [
		'**/*.{htm,html,vue}',
	],
	standard: [
		'**/*.{js,es6,jsx}',
	],
	xo: [
		'**/*.{js,es6,jsx}',
	],
}

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
			describe: 'lint code that diff with master of config branch',
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
			describe: 'debug',
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
			// 'csslint',
			'eslint',
			'htmlhint',
			// 'jscs',
			// 'jshint',
			// 'standard',
			'stylelint',
			'tslint',
			// 'xo',
			'eclint',
		]
		moduleNames.forEach(linter => {
			if (linters[linter]) {
				linters[linter].$0 = Module._findPath(linter, paths)
			} else if ((linter in pkj.devDependencies) || (linter in pkj.dependencies)) {
				linters[linter] = {
					_: [],
					$0: Module._findPath(linter, paths),
				}
			} else {
				return
			}
			if (globs[linter] && !linters[linter]._.length) {
				linters[linter]._ = globs[linter]
			}
			if (!('fix' in linters[linter])) {
				linters[linter].fix = mainArgv.fix
			}
		})
	}).catch(() => {

	}).then(() => {
		return flow(mainArgv, linters)
	}).catch(error => {
		process.exitCode = -1
		if (error.plugin === 'gulp-reporter') {
			console.error(String(error))
		} else {
			console.error(error)
		}
	})
}

module.exports = splitArgv
