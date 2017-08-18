const path = require('path')
const through = require('through2')
const Vinyl = require('vinyl')
const Git = require('./git')

class GitStream {
	constructor (options) {
		options = Object.assign({}, options)
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

	get write () {
		let files = {}
		let hasChange
		function transform (file, encoding, callback) {
			const git = file.git
			if (git) {
				if (git.isOldFile) {
					callback()
					return
				}
				if (
					git.isNewFile &&
					file.isBuffer() &&
					!file.contents.equals(file.git.content)
				) {
					hasChange = true
					files[git.path] = file.contents
				}
			}
			callback(null, file)
		}
		function flush (callback) {
			if (hasChange) {
				this.git.updateIndex(files).then(() => callback(), callback)
			} else {
				callback()
			}
			hasChange = false
			files = {}
		}
		return through.obj(transform, flush)
	}

	getVinyl (diffFile, properties) {
		const oid = diffFile.id()
		return this.git.getBlobContent(oid).then(content => {
			if (content) {
				const filePath = diffFile.path()
				return new Vinyl({
					path: path.join(this.git.cwd, filePath),
					cwd: this.git.cwd,
					base: this.git.cwd,
					contents: content,
					git: Object.assign({
						id: oid,
						content,
						path: filePath,
					}, properties),
				})
			}
		})
	}

	toStream (arrConvenientPatch) {
		const stream = through.obj()
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
						}
						stream.push(newFile)
					}
				})
			))).then(arrFiles => (
				stream.end()
			))
		}).catch(stream.emit.bind(stream, 'error'))
		return stream
	}
}

module.exports = GitStream

var s = new GitStream()

s.staged.on('data', file => {
	console.log(file.git)
})
