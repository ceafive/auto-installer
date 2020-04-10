const fs = require("fs");
const glob = require("glob");
const compiler = require("vue-template-compiler");
const colors = require("colors");
const argv = require("yargs").argv;
const packageJson = require("package-json");
const isBuiltInModule = require("is-builtin-module");
const notifier = require("node-notifier");
const whichpm = require("which-pm");
const execa = require("execa");
const Listr = require("listr");

const detective = require("./detective");
require("../node_modules/regenerator-runtime/runtime");

/* File reader
 * Return contents of given file
 */
const readPackageJson = (path) => {
  const content = fs.readFileSync(path, "utf8");
  return content;
};

/* Get installed modules
 * Read dependencies array from package.json
 */

const getInstalledModules = () => {
  const content = JSON.parse(readPackageJson("package.json"));
  const installedModules = [];

  const dependencies = content.dependencies || {};
  const devDependencies = content.devDependencies || {};

  for (let key of Object.keys(dependencies)) {
    installedModules.push({
      name: key,
      dev: false,
    });
  }
  for (let key of Object.keys(devDependencies)) {
    installedModules.push({
      name: key,
      dev: true,
    });
  }
  return installedModules;
};

/* Get all js and vue files files
 * Return path of all js files
 */
const getFilesPath = () => {
  const path1 = glob.sync("**/*.js", { ignore: ["node_modules/**/*"] });
  // const path4 = glob.sync("**/*.ts", { ignore: ["node_modules/**/*"] });
  const path2 = glob.sync("**/*.jsx", { ignore: ["node_modules/**/*"] });
  const path3 = glob.sync("**/*.vue", { ignore: ["node_modules/**/*"] });
  return path1.concat(path2, path3);
};

/* Check for valid string - to stop malicious intentions */

const isValidModule = (name) => {
  // let regex = new RegExp("^([a-z0-9-_]{1,})$");
  let regex = new RegExp("^([@a-z0-9-_/]{1,})$");
  return regex.test(name);
};

/* Find modules from file
 * Returns array of modules from a file
 */

const getModulesFromFile = (path) => {
  const content = fs.readFileSync(path, "utf8");
  let output;
  if (path.endsWith(".vue"))
    output = compiler.parseComponent(content).script.content;
  else output = content;

  // return output;
  let allModules = [];

  //set options for babel parser used in detective module
  const detectiveOptions = {
    sourceType: "module",
    errorRecovery: true,
    allowImportExportEverywhere: true,
  };
  try {
    //sniff file for ES6 import statements
    allModules = detective(output, detectiveOptions);
  } catch (err) {
    if (err.includes) handleError(err);
  }

  // return filtered modules;
  allModules = allModules.filter((module) => isValidModule(module));
  return allModules;
};

/* Is test file?
 * [.spec.js, .test.js] are supported test file formats
 */

const isTestFile = (name) =>
  name.endsWith(".spec.js") || name.endsWith(".test.js");

/* Dedup similar modules
 * Deduplicates list
 * Ignores/assumes type of the modules in list
 */

const deduplicateSimilarModules = (modules) => {
  let dedupedModules = [];
  let dedupedModuleNames = [];

  for (let module of modules) {
    if (!dedupedModuleNames.includes(module.name)) {
      dedupedModules.push(module);
      dedupedModuleNames.push(module.name);
    }
  }

  return dedupedModules;
};

/* Dedup modules
 * Divide modules into prod and dev
 * Deduplicates each list
 */

const deduplicate = (modules) => {
  let dedupedModules = [];
  //push 'dev' dependecies into array
  let testModules = modules.filter((module) => module.dev);
  dedupedModules = dedupedModules.concat(
    deduplicateSimilarModules(testModules)
  );
  //push 'prod' dependecies into array
  let prodModules = modules.filter((module) => !module.dev);
  dedupedModules = dedupedModules.concat(
    deduplicateSimilarModules(prodModules)
  );
  return dedupedModules;
};

/* Get used modules
 * Read all .js, .vue. jsx files and grep for modules
 */

const getUsedModules = () => {
  //grab all files matching extensions programmed in "getFilesPath" function
  const filesPath = getFilesPath();
  let usedModules = [];
  //loop through returned 'filesPath' array
  for (const filePath of filesPath) {
    // Sniff each file for modules used in file
    let modulesFromFile = getModulesFromFile(filePath);
    //check and set set 'dev' key on file extenstion matching ".test.js" or ".spec.js"
    const dev = isTestFile(filePath);
    for (const name of modulesFromFile) usedModules.push({ name, dev });
  }

  usedModules = deduplicate(usedModules);
  return usedModules;
};

/* Handle error
 * Pretty error message for common errors
 */

const handleError = (err, moduleName = "") => {
  if (typeof err === "string" && err.includes("E404")) {
    console.log(
      colors.yellow(`${colors.green(moduleName)} is not in the npm registry.`)
    );
  } else if (typeof err === "string" && err.includes("ENOTFOUND")) {
    console.log(
      colors.red("Could not connect to npm, check your internet connection!")
    );
  } else {
    console.log("Error", `${colors.red(err)}`);
  }
};

/* Get package manager used
 *
 */
const whichPackageManager = async () => {
  try {
    const res = await whichpm(process.cwd());
    return res.name;
  } catch (err) {
    handleError(err);
  }
};

/* Get install command
 * Depends on package manager, dev and exact
 */

const getInstallCommand = async (name, dev) => {
  const cmd = await whichPackageManager();

  let args;
  if (cmd === "npm" || cmd === "pnpm") {
    args = [`install`, `${name}`, `--save`];
    if (dev) {
      args.pop();
      args.push(`--save-dev`);
    }
    if (argv.exact) args.push(`--save-exact`);
  } else if (cmd === "yarn") {
    args = [`add`, `${name}`];
    if (dev) args.push(`--dev`);
    // yarn always adds exact
  }
  return args;
};

/* Command runner
 * Run a given command
 */

const runCommand = async (args, moduleName, notifyMode) => {
  const cmd = await whichPackageManager();
  let message = `${moduleName} installed`;

  const found = args.find(
    (e) => e.includes("uninstall") || e.includes("remove")
  );
  if (found) message = `${moduleName} removed`;

  try {
    execa.sync(cmd, args);
    if (notifyMode) showNotification(message);
  } catch (err) {
    if (notifyMode) showNotification(`Error installing ${moduleName}`);
    handleError(err.stderr, moduleName);
  }
};

/* Instantiate Listr task runner
 * Install/Uninstall given module
 */

const taskRunner = (args, name, message, notifyMode) => {
  const tasks = new Listr([
    {
      title: `${message} `,
      task: () => {
        runCommand(args, name, notifyMode);
      },
    },
  ]);

  tasks.run().catch((err) => {
    return handleError(err.stderr);
  });
};

/* Install module
 * Install given module
 */

const installModule = async ({ name, dev }, notifyMode) => {
  const args = await getInstallCommand(name, dev);
  const message = `Installing ${colors.green(name)}`;

  taskRunner(args, name, message, notifyMode);
};

/* is scoped module? */

const isScopedModule = (name) => name[0] === "@";

/* Install module if scoped ie. begins with @ */

const installModules = ({ name, dev }, notifyMode) => {
  // Check and install scoped modules found in npm registry
  if (isScopedModule(name)) {
    packageJson(name)
      .then(() => installModule({ name, dev }, notifyMode))
      .catch((e) => handleError(e.name));
  } else {
    //install modules found in npm registry
    installModule({ name, dev }, notifyMode);
  }
};

/* Get uninstall command
 *
 * Depends on package manager
 */

const getUninstallCommand = async (name) => {
  const cmd = await whichPackageManager();

  let args;
  if (cmd === "npm" || cmd === "pnpm")
    args = [`uninstall`, `${name}`, `--save`];
  else if (cmd === "yarn") args = [`remove`, `${name}`];

  return args;
};

/* Uninstall module */

const uninstallModule = async ({ name, dev }, notifyMode) => {
  if (dev) return;
  const args = await getUninstallCommand(name);
  const message = `Uninstalling ${colors.red(name)}`;

  taskRunner(args, name, message, notifyMode);
};

/* Remove built in/native modules */

const removeBuiltInModules = (modules) =>
  modules.filter((module) => !isBuiltInModule(module.name));

/* Remove file paths from module names
 * Example: convert `colors/safe` to `colors`
 */

const removeFilePaths = (modules) => {
  for (let module of modules) {
    let slicedName = module.name.split("/")[0];
    if (slicedName.substr(0, 1) !== "@") module.name = slicedName;
  }
  return modules;
};

/* Filter registry modules */

const filterRegistryModules = (modules) =>
  removeBuiltInModules(removeFilePaths(modules));

/* Get module names from array of module objects */

const getNamesFromModules = (modules) => modules.map((module) => module.name);

/* Modules diff */

const diff = (first, second) => {
  let namesFromSecond = getNamesFromModules(second);
  return first.filter((module) => !namesFromSecond.includes(module.name));
};

/* Reinstall modules */

const cleanup = async () => {
  const cmd = await whichPackageManager();
  const message = colors.yellow("Cleaning up");
  const name = `Dependencies`;

  let args;
  if (cmd === "npm" || cmd === "pnpm" || cmd === "yarn") args = [`install`];

  taskRunner(args, name, message, false);
};

/* Does package.json exist?
 * Without package.json, most of the functionality fails
 *     installing + adding to package.json
 *     removing unused modules
 */

const packageJSONExists = () => fs.existsSync("package.json");

/* Public helper functions */

/* Display Notifications */

const showNotification = (message) => {
  notifier.notify({
    title: "auto-installer running",
    message: message,
    open: 0,
    wait: false,
    sound: "Pop",
  });
};

module.exports = {
  isValidModule,
  getFilesPath,
  getInstalledModules,
  getUsedModules,
  filterRegistryModules,
  installModules,
  uninstallModule,
  diff,
  cleanup,
  packageJSONExists,
  showNotification,
};
