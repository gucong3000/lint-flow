"use strict";
const reporter = require("gulp-reporter");
const filter = require("./gulp-filter");
const debug = require("./gulp-debug");
const gulpif = require("gulp-if");
const mm = require("micromatch");
const vfs = require("vinyl-fs");
const isCI = require("ci-info").isCI;
const isPreCommit = getEvnAuthor();
const gitStream = require("./git/")

function getEvnAuthor () {
	if (/^@?(\d+)(?:\s+[+-]\d+)?$/.test(process.env.GIT_AUTHOR_DATE)) {
		const time = RegExp.$1 - 0;
		const name = process.env.GIT_AUTHOR_NAME;
		const email = process.env.GIT_AUTHOR_EMAIL;
		if (time && name && email) {
			return {
				name: name,
				email: email,
				time: time,
			};
		}
	}
}

const mmOpts = {
	dot: true,
};

const globs = {
	jsonlint: [
		"**/*.json",
	],
	stylelint: [
		"**/*.{css,sass,scss,less,sss,vue,ux,htm,html,xhtml}",
	],
	tslint: [
		"**/*.ts",
		"!**/*.d.ts",
	],
	eslint: [
		"**/*.{js,es6,jsx,vue,ux}",
	],
	htmlhint: [
		"**/*.{htm,html,xhtml}",
	],
	stylint: [
		"**/*.styl",
	],
	csslint: [
		"**/*.css",
	],
	eclint: null,
};

globs.standard = globs.xo = globs.jscs = globs.jshint = globs.eslint;

const pluginMap = {
	eclint: options => {
		const eclint = require("eclint");
		if (options.fix) {
			return eclint.fix(options)
		} else {
			return eclint.check(options);
		}
	},
	stylelint: options => (
		require("gulp-html-postcss")([
			require("stylelint")(options),
		])
	),
};

function flow (options, linters) {
	linters = linters.map(linter => {
		if (!("fix" in linter)) {
			linter.fix = options.fix;
		}

		if (!linter._.length && (linter.$0 in globs)) {
			linter._ = globs[linter.$0];
		}

		let plugin = linter.$0;

		if (typeof plugin === "string") {
			if (plugin in pluginMap) {
				plugin = pluginMap[plugin];
			} else {
				plugin = require("gulp-" + plugin);
			}
		}

		const opts = {
			...linter,
			$0: null,
			_: null,
		};

		if (linter._) {
			plugin = gulpif(
				file => (
					mm.any(file.relative, linter._, mmOpts)
				),
				plugin(opts)
			);
		} else {
			plugin = plugin(opts);
		}
		return plugin;
	});

	const gitOptions = {
		gitWorkTree: options.gitWorkTree,
		gitDir: options.gitDir,
		debug: options.debug,
	};
	let stream;
	const git = gitStream(gitOptions);

	if (options.staged) {
		stream = git.staged();
	} else if (options.unstaged) {
		stream = git.unstaged();
	} else if (options.diff) {
		if (typeof options.diff === "string") {
			stream = git.diffWithIndex(options.diff);
		} else {
			stream = git.diffWithIndex();
		}
	} else if (isCI) {
		stream = git.diffWithIndex();
	} else if (isPreCommit) {
		stream = git.staged();
	} else {
		stream = git.unstaged();
	}

	if (options.fix == null) {
		options.fix = !isCI;
	}

	if (!(options._ && options._.length)) {
		options._ = [
			"!**/dist/**/*",
		];
	}

	stream = stream.pipe(
		git.catFile(options)
	);

	linters.forEach(linter => {
		stream = stream.pipe(linter);
	});

	stream = stream
		.pipe(
			filter(options._)
		)
		.pipe(
			// save file to workdir
			gulpif(
				file => options.fix && !file.isNull() && file.inWorkdir && (!file.rawContents || !file.rawContents.equals(file.contents)),
				vfs.dest(".")
			)
		)
		.pipe(
			// update git index
			gulpif(
				file => options.fix && file.inIndex,
				git.updateIndex()
			)
		)
		.pipe(
			// exclude git diff src files from stream
			filter(file => !file.dstFile)
		)
		.pipe(
			// show debug info
			gulpif(
				options.debug,
				debug({
					title: "lint-flow",
				})
			)
		)
		.pipe(
			// show lint result
			reporter({
				fail: options.fail == null ? true : options.fail,
				// mapper: file => {
				// 	const path = file.path;
				// 	return error => {
				// 		// Do not report unrelated errors.
				// 		if (error.fileName === path) {
				// 			return error;
				// 		}
				// 	};
				// },
			})
		);

	return stream;
}

module.exports = flow;
