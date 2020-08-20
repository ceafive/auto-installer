const path = require("path")
const nodeExternals = require("webpack-node-externals")
const webpack = require("webpack")

module.exports = {
  mode: "production",
  devtool: "none",
  entry: { index: "./src/index.js" },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "lib"),
  },
  stats: {
    // Ignore warnings due to yarg's dynamic module loading
    warningsFilter: [/node_modules\/yargs/],
  },
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
            plugins: ["@babel/plugin-transform-runtime"],
          },
        },
      },
    ],
  },
  target: "node",
  externals: [nodeExternals()],
}
