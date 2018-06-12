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
    project: 'PeerTube'
  },

  multiCapabilities: [
    {
      browserName: 'Chrome',
      version: '66',
      name: 'Latest Chrome Desktop'
    },
    {
      browserName: 'Safari',
      version: '11.1',
      name: 'Safari Desktop'
    },
    {
      browserName: 'Firefox',
      version: '52', // ESR,
      name: 'Old Firefox ESR Desktop'
    },
    {
      browserName: 'Firefox',
      version: '60',
      name: 'Latest Firefox Desktop'
    },
    {
      browserName: 'Edge',
      version: '16',
      name: 'Latest Edge Desktop'
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
      device: 'iPhone SE',
      realMobile: 'true',
      os_version: '11.2',
      name: 'Latest Safari iPhone'
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
