const path = require('path')
const fs = require('fs-extra')
const {
	Repository,
	// Reference,
	Diff,
	Blob,
	Merge,
	IndexTime,
} = require('nodegit')

function patchFilter (arrFiles) {
	return arrFiles.filter(file => (
		!(
			file.isConflicted() ||
			file.isDeleted() ||
			file.isIgnored()
		) && (
			file.isModified() ||
			(file.isAdded || file.isNew).apply(file)
		)
	))
}

class Git {
	constructor (cwd = process.cwd(), gitDir = process.env.GIT_DIR || '.git') {
		this.cwd = path.resolve(cwd)
		this.gitDir = gitDir
		this.repository = Repository.open(path.join(this.cwd, gitDir))
	}
	get staged () {
		return this.repository.then(repository => (
			Promise.all([
				this.repository.then(repository => (
					repository.getHeadCommit()
				)).then(commit => (
					commit.getTree()
				)),
				this.repository.then(repository => (
					repository.index()
				)),
			]).then(([
				headTree,
				index,
			]) => (
				Diff.treeToIndex(repository, headTree, index)
			)).then(diff => (
				diff.patches()
			)).then(patchFilter)
		))
	}
	diffWithWorkdir (commit) {
		return Promise.all([
			this.repository,
			commit.getTree(),
		]).then(([
			repository,
			tree,
		]) => (
			Diff.treeToWorkdir(repository, tree)
		)).then(diff => (
			diff.patches()
		)).then(patchFilter)
	}
	get changed () {
		return this.repository.then(repository => (
			repository.getHeadCommit()
		)).then(this.diffWithWorkdir.bind(this))
	}
	diff (branchName = 'master') {
		return this.repository.then(repository => (
			Promise.all([
				repository.getBranchCommit(branchName).catch(() => (
					repository.getBranchCommit('origin/' + branchName)
				)),
				repository.getHeadCommit(),
			]).then(([
				masterCommit,
				headCommit,
			]) => (
				Merge.base(repository, masterCommit, headCommit)
			)).then(oid => (
				repository.getCommit(oid)
			))
		)).then(this.diffWithWorkdir.bind(this))
	}
	getBlobContent (oid) {
		return this.repository.then(repository => (
			!oid.iszero() && repository.getBlob(oid).then(blob => (
				blob.content()
			))
		))
	}
	updateIndex (files) {
		return this.repository.then(repository => (

			repository.index().then(index => {
				const arrayIndexEntry = index.entries()
				files = files.map(([
					oid,
					path,
					content,
				]) => {
					const size = Buffer.byteLength(content)
					const indexEntry = oid && arrayIndexEntry.find(indexEntry => (
						indexEntry.id.equal(oid)
					))
					if (indexEntry) {
						return Blob.createFromBuffer(repository, content, size).then(id => {
							indexEntry.id = id
							indexEntry.fileSize = size
							indexEntry.mtime = new IndexTime()
							return index.add(indexEntry)
						})
					} else {
						return fs.writeFile(path, content)
					}
				})
				return Promise.all(files)
			})
		))
	}
}

module.exports = Git
