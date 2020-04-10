# auto-installer

Auto installs dependencies as you code. Just hit save (CTRL + S)

![Auto installs dependencies as you code](https://raw.githubusercontent.com/ceafive/auto-installer/master/demo.gif)

#### Install

Install globally with `npm install -g auto-installer`. **Recommended.**

Do not install per project as it will uninstall itself

#### Usage

Run `auto-installer` in the directory you are working in.

Modules in `.spec.js` and `.test.js` are added to `devDependencies`

#### Options

**You can add these optional flags**

`--exact` Install exact version similar to `npm install express --save-exact`

`--uninstall` Uninstall unused modules

`--notify` Enable notifications for when dependencies are installed or uninstalled

#### Show your support

:star: this repo

#### License

MIT © [ceafive](https://github.com/ceafive) :heart:
