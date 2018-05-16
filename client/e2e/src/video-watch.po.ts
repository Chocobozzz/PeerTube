import { browser } from 'protractor'

export class VideoWatchPage {
  navigateTo () {
    browser.waitForAngularEnabled(false)
    return browser.get('/')
  }
}
