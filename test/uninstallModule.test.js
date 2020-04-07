const helpers = require("../src/helpers.js");

describe("uninstallModule", () => {
  test("uninstall packages from package.json", () => {
    const moduleName = { name: "eyram", dev: false };
    // return;
    helpers.uninstallModule(moduleName);

    // expect(returned).toBe(true);
  });
});
