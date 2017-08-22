const path = require('path')
const fs = require('fs-extra')
const {
	Repository,
	// Reference,
	Diff,
	Blob,
	Merge,
} = require('nodegit')

function patchFilter (arrConvenientPatch) {
	return arrConvenientPatch.filter(convenientPatch => (
		!(
			convenientPatch.isConflicted() ||
			convenientPatch.isDeleted() ||
			convenientPatch.isIgnored()
		) && (
			convenientPatch.isModified() ||
			(convenientPatch.isAdded || convenientPatch.isNew).apply(convenientPatch)
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
			repository.getHeadCommit()
		)).then(this.diffWithIndex.bind(this))
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
	diffWithIndex (commit) {
		return this.repository.then(repository => (
			Promise.all([
				commit.getTree(),
				this.repository.then(repository => (
					repository.index()
				)),
			]).then(([
				tree,
				index,
			]) => (
				Diff.treeToIndex(repository, tree, index)
			)).then(diff => (
				diff.patches()
			)).then(patchFilter)
		))
	}
	get changed () {
		return this.repository.then(repository => (
			repository.getHeadCommit()
		)).then(commit => (
			this.diffWithWorkdir(commit)
		))
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
		)).then(commit => (
			this.diffWithWorkdir(commit).then(arrConvenientPatch => (
				arrConvenientPatch.length ? arrConvenientPatch : this.diffWithIndex(commit)
			))
		))
	}
	getBlobContent (oid) {
		return this.repository.then(repository => (
			!oid.iszero() && repository.getBlob(oid).then(blob => (
				blob.content()
			))
		))
	}
	updateIndex (files) {
		let indexChanged
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
							indexChanged = true
							return index.add(indexEntry)
						})
					} else {
						return fs.writeFile(path, content)
					}
				})
				return Promise.all(files).then(() => (
					indexChanged && index.write().then(() => (
						index.writeTree()
					))
				))
			})
		))
	}
}

module.exports = Git
