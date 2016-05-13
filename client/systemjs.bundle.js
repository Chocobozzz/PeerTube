var SystemBuilder = require('systemjs-builder')
var builder = new SystemBuilder('node_modules', 'systemjs.config.js')

var toBundle = [
  'rxjs/Rx',
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/http',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/router-deprecated'
]

builder.bundle(toBundle.join(' + '), 'bundles/angular-rxjs.bundle.js')
