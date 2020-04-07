const helpers = require("./helpers");
const colors = require("colors");
const argv = require("yargs").argv;

let uninstallMode = true;
if (argv["dont-uninstall"]) uninstallMode = false;

let notifyMode = false;
if (argv["notify"]) notifyMode = true;

/* Watch files and repeat drill
 * Add a watcher, call main wrapper to repeat cycle
 */

/* Main wrapper
 * Get installed modules from package.json
 * Get used modules from all files
 * Install used modules that are not installed
 * Remove installed modules that are not used
 * After setup, initialize watchers
 */

const main = () => {
  if (!helpers.packageJSONExists()) {
    console.log(colors.red("package.json does not exist"));
    console.log(colors.red("You can create one by using `npm init`"));
    return;
  }

  let installedModules = [];
  installedModules = helpers.getInstalledModules();

  let usedModules = helpers.getUsedModules();
  usedModules = helpers.filterRegistryModules(usedModules);

  // removeUnusedModules

  if (uninstallMode) {
    let unusedModules = helpers.diff(installedModules, usedModules);
    for (let module of unusedModules)
      helpers.uninstallModule(module, notifyMode);
  }

  // installModules

  const modulesNotInstalled = helpers.diff(usedModules, installedModules);
  for (let module of modulesNotInstalled) {
    helpers.installModulesandScopedModules(module, notifyMode);
  }

  helpers.cleanup();
  // if (!watchersInitialized) initializeWatchers();
};

module.exports = main;
