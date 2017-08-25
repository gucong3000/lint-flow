const GitStream = require('./git-stream')
const debug = require('./gulp-debug')
const proxyquire = require('proxyquire')
const getStream = require('get-stream')
const reporter = require('gulp-reporter')
const multimatch = require('multimatch')
const gulpif = require('gulp-if')
const lazypipe = require('lazypipe')
const isCI = require('is-ci')

const isPreCommit = !isCI && /^@?(\d+)(?:\s+[+-]\d+)?$/.test(process.env.GIT_AUTHOR_DATE)
const mmOpts = {
	dot: true,
}
const globs = {
	stylelint: [
		'**/*.{css,sass,scss,less,sss,vue,htm,html}',
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

function requireLinter (name, options) {
	return proxyquire('gulp-' + name, {
		[name]: require(options.$0),
	})(options)
}

const pluginMap = {
	eclint: options => {
		const eclint = require(options.$0)
		if (options.fix) {
			return lazypipe()
				.pipe(eclint.fix, options)
				.pipe(eclint.check, options)()
		}
		return eclint.fix(options)
	},
	stylelint: options => (
		require('gulp-html-postcss')([
			require(options.$0)(options),
		])
	),
}

function getPlugin (name, options) {
	if (pluginMap[name]) {
		return pluginMap[name](options)
	} else {
		return requireLinter(name, options)
	}
}

function flow (options, linters) {
	if (!(options.staged || options.changed || options.diffWith)) {
		if (isCI) {
			options.diffWith = true
		} else if (isPreCommit) {
			options.staged = true
		} else {
			options.changed = true
		}
	}
	if (options.debug) {
		// console.log(options)
		console.log('linters:', Object.keys(linters).join(', '))
	}
	const gitStream = new GitStream(options)
	let stream
	if (options.staged) {
		stream = gitStream.staged
	} else if (options.changed) {
		stream = gitStream.changed
	} else if (options.diffWith) {
		const branch = options.diffWith
		stream = gitStream.diff(typeof branch === 'string' ? branch : undefined)
	}

	Object.keys(linters).forEach(linter => {
		if (globs[linter] && !linters[linter]._.length) {
			linters[linter]._ = globs[linter]
		}
		if (!('fix' in linters[linter])) {
			linters[linter].fix = options.fix
		}
	})

	Object.keys(linters).forEach(linter => {
		const condition = file => (
			!linters[linter]._.length || multimatch(file.git.path, linters[linter]._, mmOpts).length > 0
		)
		stream = stream.pipe(
			gulpif(
				condition,
				getPlugin(linter, linters[linter])
			)
		)
	})
	stream = stream
		.pipe(gitStream.write())
		.pipe(gulpif(
			options.debug,
			debug({
				title: 'lint-flow',
			})
		))
		.pipe(reporter({
			mapper: file => {
				const changedLines = file.git.changedLines()
				return error => {
					if (!error.lineNumber || changedLines[error.lineNumber]) {
						return error
					}
				}
			},
		}))
		.resume()
	return getStream.array(stream)
}

module.exports = flow
