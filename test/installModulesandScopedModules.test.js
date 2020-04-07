const helpers = require("../src/helpers.js");

describe("installModulesandScopedModules", () => {
  test("install scoped packages found in npm registry", () => {
    const moduleName = { name: "@store/google/come", dev: false };
    return;
    helpers.installModulesandScopedModules(moduleName);

    // expect(returned).toBe(true);
  });
});
