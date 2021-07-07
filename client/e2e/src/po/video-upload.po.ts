import { browser, by, element } from 'protractor'
import { FileDetector } from 'selenium-webdriver/remote'
import { join } from 'path'

export class VideoUploadPage {
  async navigateTo () {
    await element(by.css('.header .publish-button')).click()

    return browser.wait(browser.ExpectedConditions.visibilityOf(element(by.css('.upload-video-container'))))
  }

  async uploadVideo () {
    browser.setFileDetector(new FileDetector())

    const fileToUpload = join(__dirname, '../../fixtures/video.mp4')
    const fileInputSelector = '.upload-video-container input[type=file]'
    const parentFileInput = '.upload-video-container .button-file'

    // Avoid sending keys on non visible element
    await browser.executeScript(`document.querySelector('${fileInputSelector}').style.opacity = 1`)
    await browser.executeScript(`document.querySelector('${parentFileInput}').style.overflow = 'initial'`)

    await browser.sleep(1000)

    const elem = element(by.css(fileInputSelector))
    await elem.sendKeys(fileToUpload)

    // Wait for the upload to finish
    await browser.wait(async () => {
      const actionButton = this.getSecondStepSubmitButton().element(by.css('.action-button'))

      const klass = await actionButton.getAttribute('class')
      return !klass.includes('disabled')
    })
  }

  async validSecondUploadStep (videoName: string) {
    const nameInput = element(by.css('input#name'))
    await nameInput.clear()
    await nameInput.sendKeys(videoName)

    await this.getSecondStepSubmitButton().click()

    return browser.wait(browser.ExpectedConditions.urlContains('/w/'))
  }

  private getSecondStepSubmitButton () {
    return element(by.css('.submit-container my-button'))
  }
}
