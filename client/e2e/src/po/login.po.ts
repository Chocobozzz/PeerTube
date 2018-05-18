import { browser, element, by } from 'protractor'

export class LoginPage {
  async loginAsRootUser () {
    await browser.get('/login')

    await element(by.css('input#username')).sendKeys('root')
    await element(by.css('input#password')).sendKeys('test1')

    await element(by.css('form input[type=submit]')).click()

    return browser.wait(browser.ExpectedConditions.urlContains('/videos/'))
  }
}
