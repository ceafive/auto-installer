"use strict";

var fs = require("fs");
var glob = require("glob");
var detective = require("detective");
var es6detective = require("detective-es6");
var compiler = require("vue-template-compiler");
var colors = require("colors/safe");
var ora = require("ora");
var logSymbols = require("log-symbols");
var argv = require("yargs").argv;

var _require = require("child_process"),
    execSync = _require.execSync;

var packageJson = require("package-json");
var isBuiltInModule = require("is-builtin-module");
var notifier = require("node-notifier");

/* File reader
 * Return contents of given file
 */
var readPackageJson = function readPackageJson(path) {
  var content = fs.readFileSync(path, "utf8");
  return content;
};

/* Get installed modules
 * Read dependencies array from package.json
 */

var getInstalledModules = function getInstalledModules() {
  var content = JSON.parse(readPackageJson("package.json"));
  var installedModules = [];

  var dependencies = content.dependencies || {};
  var devDependencies = content.devDependencies || {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.keys(dependencies)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      installedModules.push({
        name: key,
        dev: false
      });
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = Object.keys(devDependencies)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var _key = _step2.value;

      installedModules.push({
        name: _key,
        dev: true
      });
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  return installedModules;
};

/* Get all js and vue files files
 * Return path of all js files
 */
var getFilesPath = function getFilesPath() {
  var path1 = glob.sync("**/*.js", { ignore: ["node_modules/**/*"] });
  // const path4 = glob.sync("**/*.ts", { ignore: ["node_modules/**/*"] });
  var path2 = glob.sync("**/*.jsx", { ignore: ["node_modules/**/*"] });
  var path3 = glob.sync("**/*.vue", { ignore: ["node_modules/**/*"] });
  return path1.concat(path2, path3);
};

/* Check for valid string - to stop malicious intentions */

var isValidModule = function isValidModule(name) {
  // let regex = new RegExp("^([a-z0-9-_]{1,})$");
  var regex = new RegExp("^([@a-z0-9-_/]{1,})$");
  return regex.test(name);
};

/* Find modules from file
 * Returns array of modules from a file
 */

var getModulesFromFile = function getModulesFromFile(path) {
  var content = fs.readFileSync(path, "utf8");
  var output = void 0;
  if (path.endsWith(".vue")) output = compiler.parseComponent(content).script.content;else output = content;

  // return output;
  var modules = [];
  try {
    //set options for acorn.js used in detective module
    var detectiveOptions = { parse: { sourceType: "module" } };

    //sniff file for commonJS require statements
    modules = detective(output, detectiveOptions);

    //sniff file for ES6 import statements
    var es6modules = es6detective(output, detectiveOptions);

    modules = modules.concat(es6modules);

    // return modules;
    modules = modules.filter(function (module) {
      return isValidModule(module);
    });
  } catch (err) {
    console.log(err);
  }

  return modules;
};

/* Is test file?
 * [.spec.js, .test.js] are supported test file formats
 */

var isTestFile = function isTestFile(name) {
  return name.endsWith(".spec.js") || name.endsWith(".test.js");
};

/* Dedup similar modules
 * Deduplicates list
 * Ignores/assumes type of the modules in list
 */

var deduplicateSimilarModules = function deduplicateSimilarModules(modules) {
  var dedupedModules = [];
  var dedupedModuleNames = [];

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = modules[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var _module = _step3.value;

      if (!dedupedModuleNames.includes(_module.name)) {
        dedupedModules.push(_module);
        dedupedModuleNames.push(_module.name);
      }
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return dedupedModules;
};

/* Dedup modules
 * Divide modules into prod and dev
 * Deduplicates each list
 */

var deduplicate = function deduplicate(modules) {
  var dedupedModules = [];
  //push 'dev' dependecies into array
  var testModules = modules.filter(function (module) {
    return module.dev;
  });
  dedupedModules = dedupedModules.concat(deduplicateSimilarModules(testModules));
  //push 'prod' dependecies into array
  var prodModules = modules.filter(function (module) {
    return !module.dev;
  });
  dedupedModules = dedupedModules.concat(deduplicateSimilarModules(prodModules));
  return dedupedModules;
};

/* Get used modules
 * Read all .js, .vue. jsx files and grep for modules
 */

var getUsedModules = function getUsedModules() {
  //grab all files matching extensions programmed in "getFilesPath" function
  var filesPath = getFilesPath();
  var usedModules = [];
  //loop through returned 'filesPath' array
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = filesPath[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var filePath = _step4.value;

      // Sniff files matching filepath for modules in file
      var modulesFromFile = getModulesFromFile(filePath);
      //check and set set 'dev' key on file extenstion matching ".test.js" or ".spec.js"
      var dev = isTestFile(filePath);
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = modulesFromFile[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var name = _step5.value;
          usedModules.push({ name: name, dev: dev });
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  usedModules = deduplicate(usedModules);
  return usedModules;
};

// console.log(getUsedModules());

/* Handle error
 * Pretty error message for common errors
 */

var handleError = function handleError(err) {
  if (err.includes("E404")) {
    console.log(colors.yellow("Module is not in the npm registry."), err);
  } else if (err.includes("ENOTFOUND")) {
    console.log(colors.red("Could not connect to npm, check your internet connection!"), err);
  } else console.log(colors.red("error ===>", err));
};

/* Command runner
 * Run a given command
 */

var runCommand = function runCommand(command) {
  var succeeded = true;
  try {
    execSync(command, { encoding: "utf8" });
  } catch (error) {
    succeeded = false;
    handleError(error["stderr"]);
  }
  return succeeded;
};

/* Show pretty outputs
 * Use ora spinners to show what's going on
 */

var startSpinner = function startSpinner(message, type) {
  var spinner = ora();
  spinner.text = message;
  spinner.color = type;
  spinner.start();
  return spinner;
};

var stopSpinner = function stopSpinner(spinner, message, type, notifyMode) {
  spinner.stop();
  if (!message) return;
  var symbol = void 0;
  if (type === "red") symbol = logSymbols.error;else if (type === "yellow") symbol = logSymbols.warning;else symbol = logSymbols.success;
  if (notifyMode) showNotification(message);
  console.log(symbol, message);
};

/* Get install command
 *
 * Depends on package manager, dev and exact
 */

var getInstallCommand = function getInstallCommand(name, dev) {
  var packageManager = "npm";
  if (argv.yarn) packageManager = "yarn";

  var command = void 0;

  if (packageManager === "npm") {
    command = "npm install " + name + " --save";
    if (dev) command += "-dev";
    if (argv.exact) command += " --save-exact";
  } else if (packageManager === "yarn") {
    command = "yarn add " + name;
    if (dev) command += " --dev";
    // yarn always adds exact
  }
  return command;
};

/* Install module
 * Install given module
 */

var installModule = function installModule(_ref, notifyMode) {
  var name = _ref.name,
      dev = _ref.dev;

  var spinner = startSpinner(colors.green("Installing") + " " + name + "\n", "green");

  var command = getInstallCommand(name, dev);

  var message = name + " " + colors.green("installed");
  if (dev) message += " in devDependencies";

  var success = runCommand(command);
  if (success) stopSpinner(spinner, message, "green", notifyMode);else stopSpinner(spinner, name + " " + colors.yellow("installation failed"), "yellow", notifyMode);
};

/* is scoped module? */

var isScopedModule = function isScopedModule(name) {
  return name[0] === "@";
};

/* Install module if scoped ie. begins with @ */

var installModulesandScopedModules = function installModulesandScopedModules(_ref2, notifyMode) {
  var name = _ref2.name,
      dev = _ref2.dev;

  // Check and install scoped modules found in npm registry
  if (isScopedModule(name)) {
    packageJson(name).then(function () {
      return installModule({ name: name, dev: dev }, notifyMode);
    }).catch(function (e) {
      return handleError(e.name);
    });
  } else {
    //install modules found in npm registry
    installModule({ name: name, dev: dev }, notifyMode);
  }
};

/* Get uninstall command
 *
 * Depends on package manager
 */

var getUninstallCommand = function getUninstallCommand(name) {
  var packageManager = "npm";
  if (argv.yarn) packageManager = "yarn";

  var command = void 0;

  if (packageManager === "npm") command = "npm uninstall " + name + " --save";else if (packageManager === "yarn") command = "yarn remove " + name;

  return command;
};

/* Uninstall module */

var uninstallModule = function uninstallModule(_ref3, notifyMode) {
  var name = _ref3.name,
      dev = _ref3.dev;

  if (dev) return;

  var command = getUninstallCommand(name);
  var message = name + " " + colors.red("removed");

  var spinner = startSpinner(colors.red("Uninstalling") + " " + name, "red");
  runCommand(command);
  stopSpinner(spinner, message, "red", notifyMode);
};

// installModule({ name: "eyram", dev: false });
// uninstallModule({ name: "log-symbols", dev: false });

/* Remove built in/native modules */

var removeBuiltInModules = function removeBuiltInModules(modules) {
  return modules.filter(function (module) {
    return !isBuiltInModule(module.name);
  });
};

/* Remove file paths from module names
 * Example: convert `colors/safe` to `colors`
 */

var removeFilePaths = function removeFilePaths(modules) {
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = modules[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var _module2 = _step6.value;

      var slicedName = _module2.name.split("/")[0];
      if (slicedName.substr(0, 1) !== "@") _module2.name = slicedName;
    }
  } catch (err) {
    _didIteratorError6 = true;
    _iteratorError6 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion6 && _iterator6.return) {
        _iterator6.return();
      }
    } finally {
      if (_didIteratorError6) {
        throw _iteratorError6;
      }
    }
  }

  return modules;
};

/* Filter registry modules */

var filterRegistryModules = function filterRegistryModules(modules) {
  return removeBuiltInModules(removeFilePaths(modules));
};

/* Get module names from array of module objects */

var getNamesFromModules = function getNamesFromModules(modules) {
  return modules.map(function (module) {
    return module.name;
  });
};

/* Modules diff */

var diff = function diff(first, second) {
  var namesFromSecond = getNamesFromModules(second);
  return first.filter(function (module) {
    return !namesFromSecond.includes(module.name);
  });
};

/* Reinstall modules */

var cleanup = function cleanup() {
  var spinner = startSpinner("Cleaning up\n", "green");
  if (argv.yarn) runCommand("yarn");else runCommand("npm install");
  stopSpinner(spinner);
};

/* Does package.json exist?
 * Without package.json, most of the functionality fails
 *     installing + adding to package.json
 *     removing unused modules
 */

var packageJSONExists = function packageJSONExists() {
  return fs.existsSync("package.json");
};

/* Public helper functions */

/* Display Notifications */

var showNotification = function showNotification(message) {
  notifier.notify({
    title: "auto-install",
    message: message,
    open: void 0,
    wait: false
  });
};

module.exports = {
  isValidModule: isValidModule,
  getFilesPath: getFilesPath,
  getInstalledModules: getInstalledModules,
  getUsedModules: getUsedModules,
  filterRegistryModules: filterRegistryModules,
  installModulesandScopedModules: installModulesandScopedModules,
  uninstallModule: uninstallModule,
  diff: diff,
  cleanup: cleanup,
  packageJSONExists: packageJSONExists,
  showNotification: showNotification
};