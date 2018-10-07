// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const {SpecReporter} = require('jasmine-spec-reporter')

exports.config = {
  allScriptsTimeout: 25000,
  specs: ['./src/**/*.e2e-spec.ts'],

  seleniumAddress: 'http://localhost:4444/wd/hub',

  capabilities: {
    'browserName': 'firefox',
    'moz:firefoxOptions': {
      'args': ["-headless"],
      "log": {
        "level": "info" // default is "info"
      }
    }
  },

  // maxSessions: 1,
  baseUrl: 'http://localhost:3333/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 45000,
    print: function() {}
  },

  onPrepare() {
    require('ts-node').register({
      project: require('path').join(__dirname, './tsconfig.e2e.json')
    })
    jasmine.getEnv().addReporter(new SpecReporter({   spec:  {  displayStacktrace: true    }  }))
  }
}
