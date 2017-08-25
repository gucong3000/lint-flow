lint-flow
======

[![NPM version](https://img.shields.io/npm/v/lint-flow.svg?style=flat-square)](https://www.npmjs.com/package/lint-flow)
[![Travis](https://img.shields.io/travis/gucong3000/lint-flow.svg)](https://travis-ci.org/gucong3000/lint-flow)
[![Coverage Status](https://img.shields.io/coveralls/gucong3000/lint-flow.svg)](https://coveralls.io/r/gucong3000/lint-flow)

Run linters against staged git files and don't let :poop: slip into your code base!

## Why

[Read the Medium post](https://medium.com/@okonetchnikov/make-linting-great-again-f3890e1ad6b8#.8qepn2b5l)

Linting makes more sense when running before committing your code. By doing that you can ensure no errors are going into repository and enforce code style. But running a lint process on a whole project is slow and linting results can be irrelevant. Ultimately you only want to lint files that will be committed.

This project contains a script that will run arbitrary npm and shell tasks with a list of staged files as an argument, filtered by a specified glob pattern.

## Installation and setup

1. `npm install --save-dev lint-flow husky`
1. Install and setup your linters just like you would do normally. Add appropriate `.eslintrc`, `.stylelintrc`, etc.
1. Update your `package.json` like this:
  ```json
  {
    "scripts": {
      "precommit": "lint-flow"
    }
  }
  ```

Now change a few files, `git add` some of them to your commit and try to `git commit` them.

See [examples](#examples) and [configuration](#configuration) below.

> I recommend using [husky](https://github.com/typicode/husky) to manage git hooks but you can use any other tool.

## Examples

### ESLint with default parameters for `*.js` and `*.jsx` running as a pre-commit hook

```json
{
  "scripts": {
    "precommit": "lint-flow eslint **/*.{js,jsx}"
  }
}
```

This will run `eslint --fix` and automatically add changes to the commit. Please note, that it doesn’t work well with committing hunks (`git add -p`).

### Automatically fix SCSS style with `stylefmt` and add to commit

```json
{
  "scripts": {
    "precommit": "lint-flow stylelint **/*.{css,scss}"
  }
}
```
