"use strict";
const diff = require("./diff");
const catFile = require("./cat-file");
const updateIndex = require("./update-index");
const path = require("path");

class GitStream {
	constructor (options) {
		const gitWorkTree = options.gitWorkTree || process.env.GIT_WORK_TREE;
		this.spawnOpts = {
			env: {
				GIT_DIR: options.gitDir || process.env.GIT_DIR || ".git",
			},
			cwd: gitWorkTree ? path.resolve(gitWorkTree) : process.cwd(),
			debug: options.debug,
		};
	}
	staged () {
		return diff({
			...this.spawnOpts,
			args: "--staged",
		});
	}
	unstaged () {
		return diff({
			...this.spawnOpts,
		});
	}
	catFile (...options) {
		return catFile(...options);
	}
	diffWithIndex (diffComp = "refs/remotes/origin/master...HEAD") {
		return diff({
			...this.spawnOpts,
			args: diffComp,
		});
	}
	updateIndex (...options) {
		return updateIndex(...options);
	}
}

module.exports = GitStream;
