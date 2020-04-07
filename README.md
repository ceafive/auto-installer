#### module-auto-install

Auto installs dependencies as you code. Just hit save (CTRL + S)

![Auto installs dependencies as you code](https://raw.githubusercontent.com/ceafive/module-auto-install/master/demo.gif)

#### Install

Install globally with `npm install -g module-auto-install`

Recommended. Do not install per project as it will uninstall itself

#### Usage

Run `module-auto-install` in the directory you are working in.

Modules in `.spec.js` and `.test.js` are added to `devDependencies`

#### Options

`--exact` Install exact version similar to `npm install express --save-exact`

`--dont-uninstall` Do not uninstall unused modules

`--yarn` Use [yarn](https://yarnpkg.com) instead of npm

`--notify` Enable notifications for when dependencies are installed or uninstalled

#### Show your support

:star: this repo

#### License

MIT © [ceafive](https://github.com/ceafive)

#### Sponsor

[![Sponsor](https://app.codesponsor.io/embed/LhLT2c31ydJzdLUuSR9f8mCA/ceafive/module-auto-install.svg)](https://app.codesponsor.io/link/LhLT2c31ydJzdLUuSR9f8mCA/ceafive/module-auto-install)
