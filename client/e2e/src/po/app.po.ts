import { browser, by, element } from 'protractor'

export class AppPage {

  async closeWelcomeModal () {
    const firstHandle = await browser.getWindowHandle()

    if (await element(by.css('.configure-instance-button')).isPresent() === false) return

    await element(by.css('.configure-instance-button')).click()

    await browser.sleep(5000)

    await browser.switchTo().window(firstHandle)
  }
}
