"use strict";
const version = require("../package.json").version;
const flow = require("./flow");
const yargs = require("yargs");
const fs = require("fs-extra");
const path = require("path");
const isCI = require("ci-info").isCI;

const linterNames = [
	"jsonlint",
	"htmlhint",
	"eclint",
	"tslint",
	[
		"standard",
		"xo",
		"eslint",
		"jscs",
		"jshint",
	],
	[

		"stylelint",
		"csslint",
	],
];

async function splitArgv (argv) {
	let mainArgv = [];
	let currSubArgv = mainArgv;
	let linters = {};

	argv.forEach(argv => {
		if (/^:/i.test(argv)) {
			currSubArgv = [];
			linters[argv.slice(1).trim().toLowerCase()] = currSubArgv;
		} else {
			currSubArgv.push(argv);
		}
	});
	mainArgv = yargs(mainArgv)
		.usage("Usage: $0 command globs... [options]")
		.options("staged", {
			describe: "lint code for staged files",
			type: "boolean",
		})
		.options("unstaged", {
			describe: "lint code for unstaged files",
			type: "boolean",
		})
		.options("diff", {
			describe: "lint code that diff with master or config branch",
		})
		.options("fix", {
			describe: "Automatically fix code",
			type: "boolean",
			default: !isCI,
		})
		.options("gitDir", {
			describe: "the path to GIT repository",
			type: "string",
			default: process.env.GIT_DIR || ".git",
		})
		.options("gitWorkTree", {
			describe: "the path to GIT working tree",
			type: "string",
			default: process.env.GIT_WORK_TREE || process.cwd(),
		})
		.options("fail", {
			describe: "Stop a task if an error has been reported",
			type: "boolean",
			default: "true",
		})
		.options("pkg", {
			describe: "path of `package.json`",
			type: "string",
			default: "package.json",
		})
		.options("debug", {
			describe: "Show debug info in console",
			type: "boolean",
			default: false,
		})
		.help()
		.version(version)
		.argv;

	mainArgv.gitWorkTree = path.resolve(mainArgv.gitWorkTree);
	mainArgv.pkg = path.resolve(mainArgv.gitWorkTree, mainArgv.pkg);

	const pkg = await fs.readJSON(mainArgv.pkg);
	const dependencies = [];
	[
		"dependencies",
		"devDependencies",
		"peerDependencies",
		"bundledDependencies",
		"optionalDependencies",
	].forEach(deps => {
		if (pkg[deps]) {
			dependencies.push.apply(dependencies, Object.keys(pkg[deps]));
		}
	});

	const addlinter = linter => {
		if (dependencies.indexOf(linter) >= 0) {
			linters[linter] = [];
			return true;
		}
	};

	linterNames.forEach(linter => {
		if (Array.isArray(linter)) {
			if (linter.some(linter => linter in linters)) {
				return;
			}
			linter.some(addlinter);
		} else {
			if (linter in linters) {
				return;
			}
			addlinter(linter);
		}
	});

	linters = Object.keys(linters).map(linter => {
		const argv = yargs(linters[linter]).argv;
		argv.$0 = linter;
		return argv;
	});

	if (mainArgv.debug) {
		console.log("linters:", linters.map(linter => linter.$0).join(", "));
	}

	return flow(mainArgv, linters).catch(error => {
		process.exitCode = 1;
		if (error.plugin === "gulp-reporter" && !error.showProperties) {
			console.error(String(error));
		} else {
			console.error(error);
		}
	});
}

module.exports = splitArgv;
process.on("unhandledRejection", error => {
	console.error(error);
	process.exit(1);
});
