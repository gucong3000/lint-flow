const path = require('path')
const through = require('through2')
const Vinyl = require('vinyl')
const fs = require('fs-extra')
const Git = require('./git')
const Diff = require('diff')

function changed (oldFile, newFile) {
	let result = []
	Diff.diffLines(
		oldFile.contents.toString(),
		newFile.contents.toString(),
		{
			ignoreWhitespace: true,
		}
	).forEach(part => {
		if (part.removed) {
			return
		}
		if (part.added) {
			result.push(part.value)
		} else {
			result.push(part.value.replace(/^.*?$/gm, ''))
		}
	})
	result = result.join('').match(/^.*?$/gm)
	result.unshift(null)
	return result
}

class GitStream {
	constructor (options) {
		options = Object.assign({}, options)
		this.options = options
		this.git = new Git(options.cwd, options.gitDir)
	}

	get staged () {
		return this.toStream(this.git.staged)
	}

	get changed () {
		return this.toStream(this.git.changed)
	}

	diff (branchName) {
		return this.toStream(this.git.diff(branchName))
	}

	write () {
		let files = []
		function transform (file, encoding, callback) {
			const git = file.git
			if (git) {
				if (git.isOldFile) {
					callback()
					return
				} else if (
					git.isNewFile &&
					file.isBuffer() &&
					!file.contents.equals(file.git.content)
				) {
					files.push([
						git.id,
						file.path,
						file.contents,
					])
				}
			}
			callback(null, file)
		}
		const flush = callback => {
			this.git.updateIndex(files).then(callback, callback)
			files = []
		}
		return through.obj(transform, flush)
	}

	getVinyl (diffFile, properties) {
		const filePath = diffFile.path()
		const absPath = path.join(this.git.cwd, filePath)
		const oid = diffFile.id()
		const readFile = () => fs.readFile(absPath)
		const content = oid.iszero() ? readFile() : this.git.getBlobContent(oid).catch(error => {
			if (error.errno !== -3) {
				throw error
			}
			return readFile()
		})

		return content.then(content => {
			if (content) {
				const file = new Vinyl({
					path: absPath,
					cwd: this.git.cwd,
					base: this.git.cwd,
					contents: content,
					git: Object.assign({
						id: oid,
						content,
						path: filePath,
						patch: () => (
							Diff.createPatch(
								filePath,
								content.toString(),
								file.contents.toString()
							)
						),
					}, properties),
				})
				return file
			}
		})
	}

	toStream (arrConvenientPatch) {
		const stream = through.obj()
		const errorHolder = stream.emit.bind(stream, 'error')
		arrConvenientPatch.then(arrConvenientPatch => {
			Promise.all(arrConvenientPatch.map(convenientPatch => (
				Promise.all([
					this.getVinyl(convenientPatch.oldFile(), {
						isOldFile: true,
					}),
					this.getVinyl(convenientPatch.newFile(), {
						isNewFile: true,
					}),
				]).then(([
					oldFile,
					newFile,
				]) => {
					if (newFile) {
						if (oldFile) {
							stream.push(oldFile)
							newFile.git.oldFile = oldFile
							newFile.git.changedLines = () => changed(oldFile, newFile)
						}
						stream.push(newFile)
					}
				})
			))).then(arrFiles => (
				stream.end()
			))
		}).catch(errorHolder)
		return stream.pause()
	}
}

module.exports = GitStream
