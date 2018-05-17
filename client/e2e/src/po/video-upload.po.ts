import { browser, element, by } from 'protractor'
import { join } from 'path'

export class VideoUploadPage {
  navigateTo () {
    return browser.get('/videos/upload')
  }

  async uploadVideo () {
    const fileToUpload = join(__dirname, '../../fixtures/video.mp4')

    await element(by.css('.upload-video-container input[type=file]')).sendKeys(fileToUpload)

    // Wait for the upload to finish
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(this.getSecondStepSubmitButton()))
  }

  async validSecondUploadStep (videoName: string) {
    const nameInput = element(by.css('input#name'))
    await nameInput.clear()
    await nameInput.sendKeys(videoName)

    await this.getSecondStepSubmitButton().click()

    return browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  private getSecondStepSubmitButton () {
    return element(by.css('.submit-button:not(.disabled) input'))
  }
}
