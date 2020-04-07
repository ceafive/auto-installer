const helpers = require("../src/helpers.js");

describe("getUsedModules", () => {
  test("grep modules used in .js, .jsx, .vue, .ts files", () => {
    const modules = [
      { name: "fs", dev: false },
      { name: "glob", dev: false },
      { name: "detective", dev: false },
      { name: "detective-es6", dev: false },
      { name: "vue-template-compiler", dev: false },
      { name: "colors/safe", dev: false },
      { name: "ora", dev: false },
      { name: "log-symbols", dev: false },
      { name: "yargs", dev: false },
      { name: "child_process", dev: false },
      { name: "package-json", dev: false },
      { name: "is-builtin-module", dev: false },
      { name: "axios", dev: false },
      { name: "chokidar", dev: false },
      { name: "colors", dev: false },
    ];
    const returned = helpers.getUsedModules();

    // expect(returned).toEqual(modules);
    expect(returned).toContainEqual({ name: "fs", dev: false });
  });
});
