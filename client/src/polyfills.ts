// Polyfills
// (these modules are what are in 'angular2/bundles/angular2-polyfills' so don't use that here)

require('intl');
require('intl/locale-data/jsonp/en.js');
import 'ie-shim'; // Internet Explorer

// Prefer CoreJS over the polyfills above
import 'core-js/es6';
import 'core-js/es7/reflect';
require('zone.js/dist/zone');

// Typescript emit helpers polyfill
import 'ts-helpers';

if ('production' !== ENV) {
  Error.stackTraceLimit = Infinity;

  require('zone.js/dist/long-stack-trace-zone');
}
