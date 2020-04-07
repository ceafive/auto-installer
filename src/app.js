const chokidar = require("chokidar");

const main = require("./index");
const helpers = require("./helpers");

let initializeWatchers = () => {
  const watcher = chokidar.watch(helpers.getFilesPath());
  watcher.on("change", main).on("unlink", main);

  console.log("Watchers initialized");
};

/* Turn the key */
initializeWatchers();
