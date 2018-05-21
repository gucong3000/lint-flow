"use strict";
const isBinaryPath = require("is-binary-path");
const File = require("../file");
const path = require("path");
const readStream = require("../read-stream");
const fs = require("fs");

const {
	Repository,
	IndexEntry,
	Reference,
	Blame,
	Diff,
	Merge,
	Oid,
} = require("nodegit");
class Git {
	constructor (options = {}) {
		const gitWorkTree = options.gitWorkTree || process.env.GIT_WORK_TREE;
		this.gitWorkTree = gitWorkTree ? path.resolve(gitWorkTree) : process.cwd();
		this.gitDir = options.gitDir || process.env.GIT_DIR || ".git";
	}
	async repository () {
		const repository = await Repository.open(path.resolve(this.gitWorkTree, this.gitDir));
		if (path.resolve(repository.workdir()) !== path.resolve(this.gitWorkTree)) {
			repository.setWorkdir(this.gitWorkTree, 0);
		}
		this.repository = () => repository;
		return repository;
	}
	async index () {
		const repository = await this.repository();
		const index = await repository.index();
		this.index = () => index;
		return index;
	}
	async lsFiles () {
		const index = await this.index();
		return index.entries().map(indexEntry => {
			return new File({
				cwd: this.gitWorkTree,
				mode: indexEntry.mode,
				blob: indexEntry.id,
				// stage,
				inIndex: true,
				relative: indexEntry.path,
			});
		});
	}
	async catFile (file, options = {}) {
		options = {
			skipBin: true,
			...options,
		};

		if (options.skipBin && isBinaryPath(file.path)) {
			return null;
		}
		const readFile = () => {
			return readStream(fs.createReadStream(file.history[0]), options);
		};
		if (file.inWorkdir) {
			return readFile();
		} else {
			let blob = file.blob;

			const repository = await this.repository();
			try {
				blob = await repository.getBlob(blob);
			} catch (ex) {
				file.inWorkdir = true;
				file.blob = Oid.fromString("0");
				return readFile();
			}
			if (options.skipBin && blob.isBinary()) {
				return null;
			}
			const contents = blob.content();
			if (file.inIndex && file.inWorkdir == null) {
				try {
					const fsContents = await readFile();
					file.inWorkdir = fsContents.equals(contents);
				} catch (ex) {
					file.inWorkdir = false;
				}
			}

			return contents;
		}
	}
	async diff2Files (diff, srcProps = {}, dstProps = {}) {
		diff = await diff;
		const patches = await diff.patches();
		const files = [];
		patches.forEach(async convenientPatch => {
			if (convenientPatch.isDeleted()) {
				return;
			}
			const newFile = convenientPatch.newFile();

			const dstFile = new File({
				cwd: this.gitWorkTree,
				mode: newFile.mode(),
				blob: newFile.id(),
				relative: newFile.path(),
				...dstProps,
			});

			if (!convenientPatch.isAdded()) {
				const oldFile = convenientPatch.oldFile();
				const srcFile = new File({
					cwd: this.gitWorkTree,
					mode: oldFile.mode(),
					blob: oldFile.id(),
					relative: oldFile.path(),
					dstFile,
					...srcProps,
				});
				dstFile.srcFile = srcFile;
				files.push(srcFile, dstFile);
				return;
			}

			files.push(dstFile);
		});
		return files;
	}
	async unstaged () {
		return this.diff2Files(
			Diff.indexToWorkdir(await this.repository(), await this.index()),
			{
				inIndex: true,
				inWorkdir: false,
			},
			{
				inIndex: false,
				inWorkdir: true,
			}
		);
	}
	async staged () {
		return this.diffWithIndex(await this.getHeadCommit(), false);
	}
	async diffWithIndex (commit = "refs/remotes/origin/master", mergeBase = true) {
		const repository = await this.repository();

		if (typeof commit === "string") {
			try {
				commit = await Reference.dwim(repository, commit);
			} catch (exDwim) {
				try {
					commit = await repository.getCommit(commit);
				} catch (ex) {
					throw exDwim;
				}
			}

			if (commit.target) {
				commit = commit.target();
			}
		}

		if (mergeBase) {
			commit = await this.mergeBase(commit, (await this.getHeadCommit()).id());
		}

		if (commit.constructor.name === "Oid") {
			commit = await repository.getCommit(commit);
		}

		return this.diff2Files(
			Diff.treeToIndex(await this.repository(), await commit.getTree(), await this.index()),
			{
				inWorkdir: false,
				inIndex: false,
			},
			{
				inIndex: true,
			}
		);
	}
	async mergeBase (...options) {
		return Merge.base(await this.repository(), ...options);
	}
	async getHeadCommit () {
		const repository = await this.repository();
		const commit = await repository.getHeadCommit();
		this.getHeadCommit = () => commit;
		return commit;
	}
	async blame (file, options = {}) {
		const relative = this.relative(file.history[0]);
		const repository = await this.repository();
		let blame = await Blame.file(repository, relative);
		if (file.isBuffer()) {
			const contents = file.contents;
			blame = await blame.buffer(contents.toString(), contents.length);
		}
		return new Proxy(blame, {
			get: (target, property) => {
				if (!/^\d+$/.test(property)) {
					return;
				}
				const blameHunk = blame.getHunkByLine(Number.parseInt(property));
				return Object.assign(
					blameHunk,
					{
						finalCommit: async () => (
							repository.getCommit(await blameHunk.finalCommitId())
						),
						origCommit: async () => (
							repository.getCommit(await blameHunk.origCommitId())
						),
					}
				);
			},
		});
	}
	async hashObject (file) {
		if (file.isNull()) {
			return Oid.fromString("0");
		}
		const repository = await this.repository();
		return repository.createBlobFromBuffer(file.contents);
	}
	async updateIndex (file) {
		if (file.isDirectory()) {
			return;
		}
		const index = await this.index();
		const relative = this.relative(file.history[0]);

		if (file.isNull()) {
			index.remove(relative);
		} else {
			const blob = await this.hashObject(file);
			const oldIndexEntry = index.getByPath(relative);
			const indexEntry = oldIndexEntry || new IndexEntry();
			indexEntry.fileSize = file.contents.length;
			indexEntry.path = this.relative(file.path);
			indexEntry.id = blob;
			file.blob = blob;
			if (file.mode) {
				indexEntry.mode = file.mode;
			}
			if (oldIndexEntry) {
				index.remove(relative);
			}
			index.add(indexEntry);
		}
	}
	relative (file) {
		let relative = path.relative(this.gitWorkTree, file);
		if (path.sep === "\\") {
			relative = relative.split(path.sep).join("/");
		}
		return relative;
	}
}

module.exports = Git;
