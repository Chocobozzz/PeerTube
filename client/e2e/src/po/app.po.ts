import { browser, by, element } from 'protractor'

export class AppPage {
  navigateTo () {
    browser.waitForAngularEnabled(false)
    return browser.get('/')
  }

  getHeaderTitle () {
    return element(by.css('.instance-name')).getText()
  }
}
