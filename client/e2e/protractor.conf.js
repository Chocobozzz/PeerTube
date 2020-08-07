// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const {SpecReporter} = require('jasmine-spec-reporter')

exports.config = {
  allScriptsTimeout: 25000,
  specs: ['./src/**/*.e2e-spec.ts'],

  seleniumAddress: 'http://hub-cloud.browserstack.com/wd/hub',
  commonCapabilities: {
    'browserstack.user': process.env.BROWSERSTACK_USER,
    'browserstack.key': process.env.BROWSERSTACK_KEY,
    'browserstack.local': true,
    'browserstack.console': 'verbose',
    'browserstack.networkLogs': true,
    'browserstack.debug': true,
    project: 'PeerTube',
    build: 'Main',
    name: 'Bstack-[Protractor] Parallel Test'
  },

  multiCapabilities: [
    {
      browserName: 'Safari',
      version: '11.1',
      name: 'Safari Desktop',
      resolution: '1280x1024'
    },
    {
      browserName: 'Chrome',
      name: 'Latest Chrome Desktop',
      resolution: '1280x1024'
    },
    {
      browserName: 'Firefox',
      version: '60', // ESR,
      name: 'Firefox ESR Desktop',
      resolution: '1280x1024'
    },
    {
      browserName: 'Firefox',
      name: 'Latest Firefox Desktop',
      resolution: '1280x1024'
    },
    {
      browserName: 'Edge',
      name: 'Latest Edge Desktop',
      resolution: '1280x1024'
    },
    {
      browserName: 'Chrome',
      device: 'Google Nexus 6',
      realMobile: 'true',
      os_version: '5.0',
      name: 'Latest Chrome Android'
    },
    {
      browserName: 'Safari',
      device: 'iPhone 8',
      realMobile: 'true',
      os_version: '12',
      name: 'Safari iPhone'
    },
    {
      browserName: 'Safari',
      device: 'iPad 7th',
      realMobile: 'true',
      os_version: '13',
      name: 'Safari iPad'
    }
  ],

  // maxSessions: 1,
  // BrowserStack compatible ports: https://www.browserstack.com/question/664
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

exports.config.multiCapabilities.forEach(function (caps) {
  for (var i in exports.config.commonCapabilities) caps[i] = caps[i] || exports.config.commonCapabilities[i]
})
