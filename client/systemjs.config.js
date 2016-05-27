;(function (global) {
  var map = {
    'angular-pipes': 'client/node_modules/angular-pipes',
    'ng2-bootstrap': 'client/node_modules/ng2-bootstrap',
    'angular-rxjs.bundle': 'client/bundles/angular-rxjs.bundle.js'
  }

  var packages = {
    'client': { main: 'main.js', defaultExtension: 'js' },
    'ng2-bootstrap': { defaultExtension: 'js' },
    'rxjs': { defaultExtension: 'js' }
  }
  var packageNames = [
    '@angular/common',
    '@angular/compiler',
    '@angular/core',
    '@angular/http',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
    '@angular/router-deprecated',
    'angular-pipes'
  ]

  packageNames.forEach(function (pkgName) {
    packages[pkgName] = { main: 'index.js', defaultExtension: 'js' }
  })

  var config = {
    map: map,
    packages: packages,
    bundles: {
      'angular-rxjs.bundle': [
        'rxjs/Rx.js',
        '@angular/common/index.js',
        '@angular/compiler/index.js',
        '@angular/core/index.js',
        '@angular/http/index.js',
        '@angular/platform-browser/index.js',
        '@angular/platform-browser-dynamic/index.js',
        '@angular/router-deprecated/index.js'
      ]
    }
  }

  // filterSystemConfig - index.html's chance to modify config before we register it.
  if (global.filterSystemConfig) global.filterSystemConfig(config)
  System.config(config)
})(this)
