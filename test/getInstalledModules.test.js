const helpers = require("../src/helpers.js");

describe("getInstalledModules", () => {
  test("grep modules installed in package.json", () => {
    const returned = helpers.getInstalledModules();
    const deps = [];

    expect(returned).toContainEqual({ dev: true, name: "jest" });
  });
});
