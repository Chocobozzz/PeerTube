"use strict";

class addCharsetWebpackPlugin {
  constructor(options) {
    this.charset = options.charset || "utf-8";
  }
  apply(compiler) {


    if (compiler.hooks && compiler.hooks.emit) {
      compiler.hooks.emit.tapAsync("addCharsetWebpackPlugin", (compilation, callback) => {
        for (const fileName of Object.keys(compilation.assets)) {

          if (!/\.css[?v=0-9]*$/.test(fileName)) continue;

          let source = compilation.assets[fileName].source();
          source = source.includes("@charset") ? source : `@charset "${this.charset}";${source}`;
          compilation.assets[fileName] = {
            source: () => source,
            size: () => compilation.assets[fileName].source().length
          }

        }
        callback();
      });
    }
    else {
      compiler.plugin("emit", (compilation, callback) => {
        for (const fileName of Object.keys(compilation.assets)) {
          console.log("****\n");
          console.log(fileName);
          console.log(compilation.assets[fileName].length);
          if (!/\.css$/.test(fileName)) continue;
          let source = compilation.assets[fileName].source();
          source = source.includes("@charset") ? source : `@charset "${this.charset}";${source}`;
          compilation.assets[fileName] = {
            source: () => source,
            size: () => compilation.assets[fileName].length
          }
        }
        callback();
      });
    }
  }
}

module.exports = addCharsetWebpackPlugin;
