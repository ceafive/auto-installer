"use strict";

var Walker = require("node-source-walk");
/**
 * Extracts the dependencies of the supplied es6 module
 *
 * @param  {String|Object} src - File's content or AST
 * @param  {Object} options - optional extra settings
 * @return {String[]}
 */


module.exports = function (src, options) {
  var walker = new Walker();
  var dependencies = [];

  if (typeof src === "undefined") {
    throw new Error("src not given");
  }

  if (src === "") {
    return dependencies;
  }

  walker.walk(src, function (node) {
    // console.log("node", node.type);
    switch (node.type) {
      case "ImportDeclaration":
        if (options && options.skipTypeImports && node.importKind == "type") {
          break;
        }

        if (!node.source) {
          return dependencies;
        }

        if (node.source && node.source.value) {
          dependencies.push(node.source.value);
        }

        break;

      case "CallExpression":
        console.log(node);
        var args = node.arguments;

        if (node.callee.name === "require" && args.length) {
          // console.log("require");
          dependencies.push(args[0].value);
        }

        if (node.callee.type === "Import" && args.length) {
          // console.log("require");
          dependencies.push(args[0].value);
        }

      default:
        return;
    }
  });
  return dependencies;
};