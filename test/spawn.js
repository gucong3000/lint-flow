"use strict";
const spawnSync = require("child_process").spawnSync;
const catFile = require("../lib/git/spawn/cat-file");
const hashObject = require("../lib/git/spawn/hash-object");
const lsFiles = require("../lib/git/spawn/ls-files");
const blame = require("../lib/git/spawn/blame");
const updateIndex = require("../lib/git/spawn/update-index");
const through = require("through2");
const diff = require("../lib/git/spawn/diff");
const expect = require("chai").expect;
const vfs = require("vinyl-fs");
const Vinyl = require("vinyl");
const path = require("path");
const fs = require("fs");

describe("git spawn", () => {
	it("ls-files", async () => {
		const fileNames = spawnSync("git", ["ls-files"], {encoding: "utf-8"}).stdout.match(/^.+$/gm).sort();
		const files = await lsFiles().pipe(catFile());

		expect(files.map(
			file => file.relative.replace(/\\/g, "/")
		).sort()).to.deep.equal(fileNames);

		files.forEach(file => {
			expect(file.contents).to.instanceOf(Buffer);
			expect(file.contents).to.have.property("length").greaterThan(0);
		});
	});

	it("diff", async () => {
		const fileNames = spawnSync("git", ["diff", "v0.0.1..HEAD", "--name-only", "--diff-filter=ACMR"], {encoding: "utf-8"}).stdout.match(/^.+$/gm);
		const files = await diff({
			args: [
				"v0.0.1..HEAD",
				"--diff-filter=ACMR",
			],
		}).pipe(
			updateIndex()
		);

		expect(files.map(
			file => file.relative.replace(/\\/g, "/")
		).sort()).to.deep.equal(fileNames.sort());
	});

	describe("blame", () => {
		const lines = fs.readFileSync("README.md", "utf-8").match(/^.*$/gm);

		it("empty file", async () => {
			const fileBlame = await blame(
				new Vinyl({
					path: path.resolve("README.md"),
				})
			);
			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("stream contents file", async () => {
			const fileBlame = await blame(
				new Vinyl({
					contents: fs.createReadStream("README.md"),
					path: path.resolve("README.md"),
				})
			);
			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("buffer contents file", async () => {
			const fileBlame = await blame(
				new Vinyl({
					contents: fs.readFileSync("README.md"),
					path: path.resolve("README.md"),
				})
			);
			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("empty file in stream", async () => {
			const fileBlame = (await vfs.src("README.md", {
				read: false,
			}).pipe(blame()))[0].blame;

			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("stream file in stream", async () => {
			const fileBlame = (await vfs.src("README.md", {
				read: true,
				buffer: false,
			}).pipe(blame()))[0].blame;

			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("buffer file in stream", async () => {
			const fileBlame = (await vfs.src("README.md", {
				read: true,
				buffer: true,
			}).pipe(blame()))[0].blame;

			fileBlame.forEach((blame, i) => {
				expect(blame).to.have.property("finalLine").equal(i + 1);
				expect(blame).to.have.property("content").equal(lines[i]);
				expect(blame.rev).to.have.property("author");
				expect(blame.rev).to.have.property("committer");
			});
		});
		it("not exist file", async () => {
			let error;
			const stream = through.obj();
			process.nextTick(() => {
				stream.end(new Vinyl({
					path: path.resolve("not_exist.md"),
				}));
			});

			await stream.pipe(blame()).catch(ex => {
				error = ex;
			});
			expect(error.message).to.match(/^fatal: no such path 'not_exist.md' in HEAD$/m);
		});
	});

	describe("cat-file", () => {
		it("skip png file", async () => {
			const files = await vfs.src("node_modules/nyc/node_modules/istanbul-reports/lib/**/*").pipe(catFile({
				skipBin: true,
			}));
			files.forEach(file => {
				expect(file.extname).to.not.equal(".png");
			});
		});
		it("not skip png file", async () => {
			const files = await vfs.src("node_modules/nyc/node_modules/istanbul-reports/lib/**/*").pipe(catFile({
				skipBin: false,
			}));

			expect(
				files.some(file => (
					file.extname === ".png"
				))
			).to.be.true;
		});
		it("not exist file", async () => {
			let error;
			const stream = through.obj();
			process.nextTick(() => {
				stream.end(new Vinyl({
					path: path.resolve("not_exist.md"),
				}));
			});

			await stream.pipe(catFile()).catch(ex => {
				error = ex;
			});
			expect(error.message).to.match(/^ENOENT: no such file or directory, open\b/m);
		});

		it("empty file", async () => {
			const contents = await catFile(
				new Vinyl({
					path: path.resolve("README.md"),
				})
			);

			expect(contents.equals(fs.readFileSync("README.md"))).to.be.true;
		});
	});

	describe("hash-object", async () => {
		it("buffer contents file", async () => {
			const blob = await hashObject(
				new Vinyl({
					path: path.resolve("README.md"),
					contents: fs.createReadStream("README.md"),
				})
			);
			expect(blob).to.match(/^\w{40}$/);
		});
		it("empty file", async () => {
			const blob = await hashObject(
				new Vinyl({
					path: path.resolve("README.md"),
				})
			);

			expect(blob).to.match(/^0{40}$/);
		});
	});

	describe.skip("update-index", async () => {
		it("buffer contents file", async () => {
			await diff({
				args: "HEAD",
			})
				.pipe(catFile())
				.pipe(hashObject({
					args: "-w",
				}))
				.pipe(updateIndex())
			;
		});
	});
});
