"use strict";

var chokidar = require("chokidar");

var main = require("./index");

var helpers = require("./helpers");

var initializeWatchers = function initializeWatchers() {
  var watcher = chokidar.watch(helpers.getFilesPath());
  watcher.on("change", main).on("unlink", main);
  console.log("Watchers initialized");
};
/* Turn the key */


initializeWatchers();