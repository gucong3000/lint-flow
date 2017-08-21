const GitStream = require('./git-stream')
const proxyquire = require('proxyquire')
const getStream = require('get-stream')
const reporter = require('gulp-reporter')
var mm = require('micromatch')
var gulpif = require('gulp-if')

function requireLinter (name, options) {
	return proxyquire('gulp-' + name, {
		name: require(options.$0),
	})(options)
}

const pluginMap = {
	'eclint': options => (
		require(options.$0)[options.fix ? 'fix' : 'check'](options)
	),
	'stylelint': options => (
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
	const gitStream = new GitStream(options)
	let stream
	if (options.staged) {
		stream = gitStream.staged
	} else if (options.changed) {
		stream = gitStream.changed
	} else {
		const branch = options['diff-with']
		stream = gitStream.diff(typeof branch === 'string' ? branch : null)
	}
	Object.keys(linters).forEach(linter => {
		const condition = file => (
			!linters[linter]._.length || mm.isMatch(file.relative, linters[linter]._)
		)
		stream = stream.pipe(
			gulpif(
				condition,
				getPlugin(linter, linters[linter])
			)
		)
	})
	stream = stream.pipe(gulpif(
		file => !(file.git.isOldFile),
		reporter()
	)).pipe(gitStream.write())
	return getStream.array(stream)
}
module.exports = flow
