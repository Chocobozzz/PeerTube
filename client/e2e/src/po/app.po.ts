import { browser, by, element } from 'protractor'

export class AppPage {

  async closeWelcomeModal () {
    const firstHandle = await browser.getWindowHandle()

    if (await element(by.css('.configure-instance-button')).isPresent() === false) return

    await element(by.css('.configure-instance-button')).click()

    await browser.switchTo().window(firstHandle)

    await browser.refresh()

    await element(by.css('.form-group-checkbox')).click()
    await element(by.css('.action-button-cancel')).click()

    await browser.switchTo().window(firstHandle)
  }
}
