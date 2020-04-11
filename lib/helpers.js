"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var fs = require("fs");

var glob = require("glob");

var compiler = require("vue-template-compiler");

var colors = require("colors");

var argv = require("yargs").argv;

var packageJson = require("package-json");

var isBuiltInModule = require("is-builtin-module");

var notifier = require("node-notifier");

var whichpm = require("which-pm");

var execa = require("execa");

var Listr = require("listr");

var detective = require("./detective");

require("../node_modules/regenerator-runtime/runtime");
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

  for (var _i = 0, _Object$keys = Object.keys(dependencies); _i < _Object$keys.length; _i++) {
    var key = _Object$keys[_i];
    installedModules.push({
      name: key,
      dev: false
    });
  }

  for (var _i2 = 0, _Object$keys2 = Object.keys(devDependencies); _i2 < _Object$keys2.length; _i2++) {
    var _key = _Object$keys2[_i2];
    installedModules.push({
      name: _key,
      dev: true
    });
  }

  return installedModules;
};
/* Get all js and vue files files
 * Return path of all js files
 */


var getFilesPath = function getFilesPath() {
  var path1 = glob.sync("**/*.js", {
    ignore: ["node_modules/**/*"]
  }); // const path4 = glob.sync("**/*.ts", { ignore: ["node_modules/**/*"] });

  var path2 = glob.sync("**/*.jsx", {
    ignore: ["node_modules/**/*"]
  });
  var path3 = glob.sync("**/*.vue", {
    ignore: ["node_modules/**/*"]
  });
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
  var output;
  if (path.endsWith(".vue")) output = compiler.parseComponent(content).script.content;else output = content; // return output;

  var allModules = []; //set options for babel parser used in detective module

  var detectiveOptions = {
    sourceType: "module",
    errorRecovery: true,
    allowImportExportEverywhere: true
  };

  try {
    //sniff file for ES6 import statements
    allModules = detective(output, detectiveOptions); // filter modules;

    allModules = allModules.filter(function (module) {
      return isValidModule(module);
    });
  } catch (err) {
    var line = content.split("\n")[err.loc.line - 1];
    var error = "Babel parser error. Could not parse '".concat(path, "'. There is a syntax error in file at line ").concat(err.loc.line, " column: ").concat(err.loc.column, "\ncausing all modules used in this file ONLY to be uninstalled");
    handleError(error);
  } // return filtered modules;


  allModules = allModules.filter(function (module) {
    return isValidModule(module);
  });
  return allModules;
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

  var _iterator = _createForOfIteratorHelper(modules),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _module = _step.value;

      if (!dedupedModuleNames.includes(_module.name)) {
        dedupedModules.push(_module);
        dedupedModuleNames.push(_module.name);
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return dedupedModules;
};
/* Dedup modules
 * Divide modules into prod and dev
 * Deduplicates each list
 */


var deduplicate = function deduplicate(modules) {
  var dedupedModules = []; //push 'dev' dependecies into array

  var testModules = modules.filter(function (module) {
    return module.dev;
  });
  dedupedModules = dedupedModules.concat(deduplicateSimilarModules(testModules)); //push 'prod' dependecies into array

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
  var usedModules = []; //loop through returned 'filesPath' array

  var _iterator2 = _createForOfIteratorHelper(filesPath),
      _step2;

  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var filePath = _step2.value;
      // Sniff each file for modules used in file
      var modulesFromFile = getModulesFromFile(filePath); //check and set set 'dev' key on file extenstion matching ".test.js" or ".spec.js"

      var dev = isTestFile(filePath);

      var _iterator3 = _createForOfIteratorHelper(modulesFromFile),
          _step3;

      try {
        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          var name = _step3.value;
          usedModules.push({
            name: name,
            dev: dev
          });
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }

  usedModules = deduplicate(usedModules);
  return usedModules;
};
/* Handle error
 * Pretty error message for common errors
 */


var handleError = function handleError(err) {
  var moduleName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";

  if (typeof err === "string" && err.includes("E404")) {
    console.log(colors.red("Error ==>"), "".concat(colors.red(moduleName), " is not in the npm registry."));
  } else if (typeof err === "string" && err.includes("ENOTFOUND")) {
    console.log(colors.red("Error ==>"), "Could not connect to npm, check your internet connection!");
  } else {
    console.log(colors.red("Error ==>"), err);
  }
};
/* Get package manager used
 *
 */


var whichPackageManager = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
    var res;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return whichpm(process.cwd());

          case 3:
            res = _context.sent;
            return _context.abrupt("return", res.name);

          case 7:
            _context.prev = 7;
            _context.t0 = _context["catch"](0);
            handleError(_context.t0);

          case 10:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, null, [[0, 7]]);
  }));

  return function whichPackageManager() {
    return _ref.apply(this, arguments);
  };
}();
/* Get install command
 * Depends on package manager, dev and exact
 */


var getInstallCommand = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(name, dev) {
    var cmd, args;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return whichPackageManager();

          case 2:
            cmd = _context2.sent;

            if (cmd === "npm" || cmd === "pnpm") {
              args = ["install", "".concat(name), "--save"];

              if (dev) {
                args.pop();
                args.push("--save-dev");
              }

              if (argv.exact) args.push("--save-exact");
            } else if (cmd === "yarn") {
              args = ["add", "".concat(name)];
              if (dev) args.push("--dev"); // yarn always adds exact
            }

            return _context2.abrupt("return", args);

          case 5:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));

  return function getInstallCommand(_x, _x2) {
    return _ref2.apply(this, arguments);
  };
}();
/* Command runner
 * Run a given command
 */


var runCommand = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(args, moduleName, notifyMode) {
    var cmd, message, found, cp;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return whichPackageManager();

          case 2:
            cmd = _context3.sent;
            message = "".concat(moduleName, " installed");
            found = args.find(function (e) {
              return e.includes("uninstall") || e.includes("remove");
            });
            if (found) message = "".concat(moduleName, " removed");
            _context3.prev = 6;
            _context3.next = 9;
            return execa.sync(cmd, args);

          case 9:
            cp = _context3.sent;
            console.log(colors.green("Added ==>"), cp.stdout.split("\n")[0]);
            if (notifyMode) showNotification(message);
            _context3.next = 18;
            break;

          case 14:
            _context3.prev = 14;
            _context3.t0 = _context3["catch"](6);
            if (notifyMode) showNotification("Error installing ".concat(moduleName));
            handleError(_context3.t0.stderr, moduleName);

          case 18:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, null, [[6, 14]]);
  }));

  return function runCommand(_x3, _x4, _x5) {
    return _ref3.apply(this, arguments);
  };
}();
/* Instantiate Listr task runner
 * Install/Uninstall given module
 */


var taskRunner = function taskRunner(args, name, message, notifyMode) {
  var tasks = new Listr([{
    title: "".concat(message, " "),
    task: function task() {
      runCommand(args, name, notifyMode);
    }
  }]);
  tasks.run()["catch"](function (err) {
    return handleError(err.stderr);
  });
};
/* Install module
 * Install given module
 */


var installModule = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(_ref4, notifyMode) {
    var name, dev, args, message;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            name = _ref4.name, dev = _ref4.dev;
            _context4.next = 3;
            return getInstallCommand(name, dev);

          case 3:
            args = _context4.sent;
            message = "Installing ".concat(colors.green(name));
            taskRunner(args, name, message, notifyMode);

          case 6:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4);
  }));

  return function installModule(_x6, _x7) {
    return _ref5.apply(this, arguments);
  };
}();
/* is scoped module? */


var isScopedModule = function isScopedModule(name) {
  return name[0] === "@";
};
/* Install module if scoped ie. begins with @ */


var installModules = function installModules(_ref6, notifyMode) {
  var name = _ref6.name,
      dev = _ref6.dev;

  // Check and install scoped modules found in npm registry
  if (isScopedModule(name)) {
    packageJson(name).then(function () {
      return installModule({
        name: name,
        dev: dev
      }, notifyMode);
    })["catch"](function (err) {// handleError(err.message);
    });
  } else {
    //install modules found in npm registry
    installModule({
      name: name,
      dev: dev
    }, notifyMode);
  }
};
/* Get uninstall command
 *
 * Depends on package manager
 */


var getUninstallCommand = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(name) {
    var cmd, args;
    return regeneratorRuntime.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return whichPackageManager();

          case 2:
            cmd = _context5.sent;
            if (cmd === "npm" || cmd === "pnpm") args = ["uninstall", "".concat(name), "--save"];else if (cmd === "yarn") args = ["remove", "".concat(name)];
            return _context5.abrupt("return", args);

          case 5:
          case "end":
            return _context5.stop();
        }
      }
    }, _callee5);
  }));

  return function getUninstallCommand(_x8) {
    return _ref7.apply(this, arguments);
  };
}();
/* Uninstall module */


var uninstallModule = /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(_ref8, notifyMode) {
    var name, dev, args, message;
    return regeneratorRuntime.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            name = _ref8.name, dev = _ref8.dev;

            if (!dev) {
              _context6.next = 3;
              break;
            }

            return _context6.abrupt("return");

          case 3:
            _context6.next = 5;
            return getUninstallCommand(name);

          case 5:
            args = _context6.sent;
            message = "Uninstalling ".concat(colors.red(name));
            taskRunner(args, name, message, notifyMode);

          case 8:
          case "end":
            return _context6.stop();
        }
      }
    }, _callee6);
  }));

  return function uninstallModule(_x9, _x10) {
    return _ref9.apply(this, arguments);
  };
}();
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
  var _iterator4 = _createForOfIteratorHelper(modules),
      _step4;

  try {
    for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
      var _module2 = _step4.value;

      var slicedName = _module2.name.split("/")[0];

      if (slicedName.substr(0, 1) !== "@") _module2.name = slicedName;
    }
  } catch (err) {
    _iterator4.e(err);
  } finally {
    _iterator4.f();
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


var cleanup = /*#__PURE__*/function () {
  var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
    var cmd, message, name, args;
    return regeneratorRuntime.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.next = 2;
            return whichPackageManager();

          case 2:
            cmd = _context7.sent;
            message = colors.yellow("Cleaning up");
            name = "Dependencies";
            if (cmd === "npm" || cmd === "pnpm" || cmd === "yarn") args = ["install"];
            taskRunner(args, name, message, false);

          case 7:
          case "end":
            return _context7.stop();
        }
      }
    }, _callee7);
  }));

  return function cleanup() {
    return _ref10.apply(this, arguments);
  };
}();
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
    title: "auto-installer running",
    message: message,
    open: 0,
    wait: false,
    sound: "Pop"
  });
};

module.exports = {
  isValidModule: isValidModule,
  getFilesPath: getFilesPath,
  getInstalledModules: getInstalledModules,
  getUsedModules: getUsedModules,
  filterRegistryModules: filterRegistryModules,
  installModules: installModules,
  uninstallModule: uninstallModule,
  diff: diff,
  cleanup: cleanup,
  packageJSONExists: packageJSONExists,
  showNotification: showNotification
};