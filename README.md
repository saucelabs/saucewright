# saucewright

CLI for dynamically configuring saucectl via playwright config files.

This project is a proof of concept and as such does not represent a fully finished product.

Do NOT use this in production.

All the warnings out of the way, how does it work? `saucewright` inspects your local _playwright.config.js/ts_ file
and generates a _config.yml_ file that saucectl understands, which it then invokes with. All this happens in one step.

This is very convenient for running adhoc tests, especially where saucectl is not yet configured. The general idea is
that `saucewright` mimics (in terms of flags/args) the playwright CLI almost 1:1, so that the user has the least amount
of friction getting started with playwright on Sauce Labs.

# TODO

This list is not exhaustive, but gives you an idea of what's still missing/possible.

- [ ] Allow user to select the playwright version (currently set to `1.27.1`)
- [ ] Allow user to select the platform (mac/win) (defaults to Windows 10)
- [ ] Add support for the other CLI native flags (run `npx saucewright test -h` to see what's implemented)
- [ ] Add support for browser == 'all'

## Requirements

- Node.js 16+
- Sauce Labs Account
- saucectl
- playwright

## Usage

```shell
Usage: saucewright test [options] [test-filter...]

Arguments:
  test-filter                  Pass arguments to filter test files. Each argument is treated as a regular expression.

Options:
  --browser <browser>          Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium").
  --headed                     Run tests in headed browsers (default: headless).
  -g, --grep <grep>            Only run tests matching this regular expression (default: ".*").
  -gv, --grep-invert <grep>    Only run tests that do not match this regular expression.
  --project <project-name...>  Only run tests from the specified list of projects (default: run all projects).
  -h, --help                   display help for command
```

### Setup Repo

Since this package is not published to any registry (for now), you have to set it up locally after cloning the repo.

#### Install Dependencies

```shell
npm i
```

#### Build Project

```shell
npm run build
```

### Setup Playwright Project

Execute the following commands in your local playwright project. 

#### Install saucewright as Dependency

```shell
npm i /path/to/saucewright
```

#### Install saucectl

Since `saucewright` requires `saucectl`:

```shell
npm i saucectl
```

#### Run Tests

```shell
npx saucewright test
```
