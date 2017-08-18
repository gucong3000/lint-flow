const path = require('path')
const Vinyl = require('vinyl')
const {
	Repository,
	// Reference,
	Diff,
	Blob,
	Merge,
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
	updateIndex (data) {
		return this.repository.then(repository => (
			repository.index().then(index => (
				Promise.all(
					Object.keys(data).map(path => {
						const content = data[path]
						const size = Buffer.byteLength(data[path])
						return index.add(Object.assign(
							index.getByPath(path),
							{
								id: Blob.createFromBuffer(repository, content, size),
								fileSize: size,
							}
						))
					})
				).then(() => (
					index.write()
				)).then(() => (
					index.writeTree()
				))
			))
		))
	}
}

module.exports = Git
