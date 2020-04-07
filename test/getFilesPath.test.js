const helpers = require("../src/helpers.js");

describe("getFilesPath", () => {
  test("glob for all files matching .js, .vue, .jsx, .ts", () => {
    const returned = helpers.getFilesPath();
    const paths = [
      "lib/helpers.js",
      "lib/index.js",
      "src/helpers.js",
      "src/index.js",
      "test/getFilesPath.test.js",
      "new.ts",
    ];

    expect(returned).toContain("src/helpers.js");
  });
});
