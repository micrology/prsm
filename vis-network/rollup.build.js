import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import { readFileSync } from "fs";

const packageJSON = JSON.parse(readFileSync("./package.json", "utf-8"));

const banner = `/**
 * vis-network - ${packageJSON.description}
 * @version ${packageJSON.version}
 * @license ${packageJSON.license}
 */`;

const external = [
  "@egjs/hammerjs",
  "component-emitter",
  "keycharm",
  "uuid",
  "vis-data",
  "vis-util",
];

const globals = {
  "@egjs/hammerjs": "Hammer",
  "component-emitter": "Emitter",
  "vis-data": "vis",
  "vis-util": "vis",
  keycharm: "keycharm",
  uuid: "uuid",
};

const plugins = [
  nodeResolve({ extensions: [".ts", ".js"] }),
  commonjs(),
  typescript({ tsconfig: "./tsconfig.code.json" }),
  postcss({ extract: "styles/vis-network.css", minimize: false }),
  babel({ babelHelpers: "bundled", extensions: [".ts", ".js"] }),
];

const pluginsMinified = [
  ...plugins.slice(0, -1),
  terser(),
];

export default [
  // ESM build
  {
    input: "./lib/entry-peer.ts",
    output: [
      {
        file: "peer/esm/vis-network.mjs",
        format: "esm",
        banner,
        sourcemap: true,
      },
    ],
    external,
    plugins,
  },
  // ESM minified
  {
    input: "./lib/entry-peer.ts",
    output: [
      {
        file: "peer/esm/vis-network.min.mjs",
        format: "esm",
        banner,
        sourcemap: true,
      },
    ],
    external,
    plugins: pluginsMinified,
  },
  // UMD build
  {
    input: "./lib/entry-peer.ts",
    output: [
      {
        file: "peer/umd/vis-network.cjs",
        format: "umd",
        name: "vis",
        extend: true,
        banner,
        sourcemap: true,
        globals,
      },
    ],
    external,
    plugins,
  },
  // UMD minified
  {
    input: "./lib/entry-peer.ts",
    output: [
      {
        file: "peer/umd/vis-network.min.cjs",
        format: "umd",
        name: "vis",
        extend: true,
        banner,
        sourcemap: true,
        globals,
      },
    ],
    external,
    plugins: pluginsMinified,
  },
];
