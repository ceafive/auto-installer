import fs from "fs";
const glob = require("glob");
const detective = require("detective");
const es6detective = require("detective-es6");
const compiler = require("vue-template-compiler");
const colors = require("colors/safe");
const ora = require("ora");
const logSymbols = require("log-symbols");
const argv = require("yargs").argv;
const { execSync } = require("child_process");
const packageJson = require("package-json");
const isBuiltInModule = require("is-builtin-module");
const https = require("https");

/* File reader
 * Return contents of given file
 */
let readFile = (path) => {
  const content = fs.readFileSync(path, "utf8");
  return content;
};

/* Get installed modules
 * Read dependencies array from package.json
 */

let getInstalledModules = () => {
  const content = JSON.parse(readFile("package.json"));
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
  // const path4 = glob.sync("./package/*.ts", { ignore: ["node_modules/**/*"] });
  const path2 = glob.sync("**/*.jsx", { ignore: ["node_modules/**/*"] });
  const path3 = glob.sync("**/*.vue", { ignore: ["node_modules/**/*"] });
  // return path4;
  return path1.concat(path2, path3);
};

/* Check for valid string - to stop malicious intentions */

let isValidModule = (name) => {
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
  let modules = [];
  try {
    //set options for acorn.js used in detective module
    const detectiveOptions = { parse: { sourceType: "module" } };

    //sniff file for commonJS require statements
    modules = detective(output, detectiveOptions);

    //sniff file for ES6 import statements
    const es6modules = es6detective(output, detectiveOptions);

    modules = modules.concat(es6modules);

    // return modules;
    modules = modules.filter((module) => isValidModule(module));
  } catch (err) {
    console.log(err);
  }

  return modules;
};

/* Is test file?
 * [.spec.js, .test.js] are supported test file formats
 */

let isTestFile = (name) =>
  name.endsWith(".spec.js") || name.endsWith(".test.js");

/* Dedup similar modules
 * Deduplicates list
 * Ignores/assumes type of the modules in list
 */

let deduplicateSimilarModules = (modules) => {
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

let deduplicate = (modules) => {
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
    // Sniff files matching filepath for modules in file
    let modulesFromFile = getModulesFromFile(filePath);
    //check and set set 'dev' key on file extenstion matching ".test.js" or ".spec.js"
    const dev = isTestFile(filePath);
    for (const name of modulesFromFile) usedModules.push({ name, dev });
  }

  usedModules = deduplicate(usedModules);
  return usedModules;
};

// console.log(getUsedModules());

/* Handle error
 * Pretty error message for common errors
 */

let handleError = (err) => {
  if (err.includes("E404")) {
    console.log(colors.yellow("Module is not in the npm registry."), err);
  } else if (err.includes("ENOTFOUND")) {
    console.log(
      colors.red("Could not connect to npm, check your internet connection!"),
      err
    );
  } else console.log(colors.red("error ===>", err));
};

/* Command runner
 * Run a given command
 */

let runCommand = (command) => {
  let succeeded = true;
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

let startSpinner = (message, type) => {
  const spinner = ora();
  spinner.text = message;
  spinner.color = type;
  spinner.start();
  return spinner;
};

let stopSpinner = (spinner, message, type) => {
  spinner.stop();
  if (!message) return;
  let symbol;
  if (type === "red") symbol = logSymbols.error;
  else if (type === "yellow") symbol = logSymbols.warning;
  else symbol = logSymbols.success;
  console.log(symbol, message);
};

/* Is module popular? - for secure mode */

const POPULARITY_THRESHOLD = 10000;
const isModulePopular = (name, callback) => {
  const spinner = startSpinner(`Checking ${name}`, "yellow");
  const url = `https://api.npmjs.org/downloads/point/last-month/${name}`;
  https
    .get(url)
    .then((response) => {
      let body = "";
      response.on("data", (data) => {
        body += data;
      });

      response.on("end", () => {
        stopSpinner(spinner);
        const downloads = JSON.parse(body).downloads;
        callback(downloads > POPULARITY_THRESHOLD);
      });
    })
    .catch((error) => {
      console.log(
        colors.red("Could not connect to npm, check your internet connection!"),
        error
      );
    });
};

/* Get install command
 *
 * Depends on package manager, dev and exact
 */

const getInstallCommand = (name, dev) => {
  let packageManager = "npm";
  if (argv.yarn) packageManager = "yarn";

  let command;

  if (packageManager === "npm") {
    command = `npm install ${name} --save`;
    if (dev) command += "-dev";
    if (argv.exact) command += " --save-exact";
  } else if (packageManager === "yarn") {
    command = `yarn add ${name}`;
    if (dev) command += " --dev";
    // yarn always adds exact
  }
  return command;
};

/* Install module
 * Install given module
 */

const installModule = ({ name, dev }) => {
  const spinner = startSpinner(
    `${colors.green("Installing")} ${name}\n`,
    "green"
  );

  const command = getInstallCommand(name, dev);

  let message = `${name} ${colors.green("installed")}`;
  if (dev) message += " in devDependencies";

  const success = runCommand(command);
  if (success) stopSpinner(spinner, message, "green");
  else
    stopSpinner(
      spinner,
      `${name} ${colors.yellow("installation failed")}`,
      "yellow"
    );
};

/* is scoped module? */

let isScopedModule = (name) => name[0] === "@";

/* Install module if author is trusted */

let installModuleIfTrustedAuthor = ({ name, dev }) => {
  let trustedAuthor = argv["trust-author"];
  packageJson(name).then((json) => {
    if (json.author && json.author.name === trustedAuthor) {
      installModule({ name, dev });
    } else console.log(colors.red(`${name} not trusted`));
  });
};

/* Install module if trusted
 * Call isModulePopular before installing
 */

let installModuleIfTrusted = async ({ name, dev }) => {
  // Trust scoped modules
  if (isScopedModule(name)) {
    packageJson(name)
      .then(() => installModule({ name, dev }))
      .catch((e) => handleError(e.name));
  } else {
    isModulePopular(name, (popular) => {
      // Popular as proxy for trusted
      if (popular) installModule({ name, dev });
      // Trusted Author
      else if (argv["trust-author"])
        installModuleIfTrustedAuthor({ name, dev });
      // Not trusted
      else console.log(colors.red(`${name} not trusted`));
    });
  }
};

/* Get uninstall command
 *
 * Depends on package manager
 */

let getUninstallCommand = (name) => {
  let packageManager = "npm";
  if (argv.yarn) packageManager = "yarn";

  let command;

  if (packageManager === "npm") command = `npm uninstall ${name} --save`;
  else if (packageManager === "yarn") command = `yarn remove ${name}`;

  return command;
};

/* Uninstall module */

const uninstallModule = ({ name, dev }) => {
  if (dev) return;

  const command = getUninstallCommand(name);
  const message = `${name} ${colors.red("removed")}`;

  const spinner = startSpinner(`${colors.red("Uninstalling")} ${name}`, "red");
  runCommand(command);
  stopSpinner(spinner, message, "red");
};

// installModule({ name: "eyram", dev: false });
// uninstallModule({ name: "log-symbols", dev: false });

/* Remove built in/native modules */

let removeBuiltInModules = (modules) =>
  modules.filter((module) => !isBuiltInModule(module.name));

/* Remove file paths from module names
 * Example: convert `colors/safe` to `colors`
 */

let removeFilePaths = (modules) => {
  for (let module of modules) {
    let slicedName = module.name.split("/")[0];
    if (slicedName.substr(0, 1) !== "@") module.name = slicedName;
  }
  return modules;
};

/* Filter registry modules */

let filterRegistryModules = (modules) =>
  removeBuiltInModules(removeFilePaths(modules));

/* Get module names from array of module objects */

let getNamesFromModules = (modules) => modules.map((module) => module.name);

/* Modules diff */

let diff = (first, second) => {
  let namesFromSecond = getNamesFromModules(second);
  return first.filter((module) => !namesFromSecond.includes(module.name));
};

/* Reinstall modules */

let cleanup = () => {
  let spinner = startSpinner("Cleaning up", "green");
  if (argv.yarn) runCommand("yarn");
  else runCommand("npm install");
  stopSpinner(spinner);
};

/* Does package.json exist?
 * Without package.json, most of the functionality fails
 *     installing + adding to package.json
 *     removing unused modules
 */

let packageJSONExists = () => fs.existsSync("package.json");

/* Public helper functions */

module.exports = {
  getFilesPath,
  getInstalledModules,
  getUsedModules,
  filterRegistryModules,
  installModule,
  installModuleIfTrusted,
  uninstallModule,
  diff,
  cleanup,
  packageJSONExists,
};
