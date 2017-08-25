const through = require('through2')
const gutil = require('gulp-util')
const chalk = require('chalk')
const title = 'lint-flow'
module.exports = function () {
	let count = 0
	function transform (file, encoding, callback) {
		let output = title + ' ' + chalk.blue(file.git.path)
		if (!file.contents.equals(file.git.content)) {
			output = file.git.patch()
				.replace(/^.*?(?=\r?\n)/, output)
				.replace(/^\+.*?$/gm, s => chalk.green(s))
				.replace(/^-.*?$/gm, s => chalk.red(s))
		}
		gutil.log(output)
		count++
		callback(null, file)
	}
	function flush (callback) {
		gutil.log(title + ' ' + chalk.green(count + ' ' + 'item'))
		callback()
		count = 0
	}
	return through.obj(transform, flush)
}
