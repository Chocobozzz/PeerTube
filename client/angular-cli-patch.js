// Remove patch when https://github.com/angular/angular-cli/issues/10681#issuecomment-389160125 is closed

const fs = require('fs');
const f = 'node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js';

fs.readFile(f, 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var result = data.replace(/node: false/g, 'node: { global: true, crypto: "empty", fs: "empty", process: true, module: false, clearImmediate: false, setImmediate: false }');

  fs.writeFile(f, result, 'utf8', function (err) {
    if (err) return console.log(err);
  });
});
