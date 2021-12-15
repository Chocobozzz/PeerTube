import { join } from 'path'
import { getCheckbox, selectCustomSelect } from '../utils'

export class VideoUploadPage {
  async navigateTo () {
    await $('.header .publish-button').click()

    await $('.upload-video-container').waitForDisplayed()
  }

  async uploadVideo () {
    const fileToUpload = join(__dirname, '../../fixtures/video.mp4')
    const fileInputSelector = '.upload-video-container input[type=file]'
    const parentFileInput = '.upload-video-container .button-file'

    // Avoid sending keys on non visible element
    await browser.execute(`document.querySelector('${fileInputSelector}').style.opacity = 1`)
    await browser.execute(`document.querySelector('${parentFileInput}').style.overflow = 'initial'`)

    await browser.pause(1000)

    const elem = await $(fileInputSelector)
    await elem.chooseFile(fileToUpload)

    // Wait for the upload to finish
    await browser.waitUntil(async () => {
      const actionButton = this.getSecondStepSubmitButton().$('.action-button')

      const klass = await actionButton.getAttribute('class')
      return !klass.includes('disabled')
    })
  }

  setAsNSFW () {
    return getCheckbox('nsfw').click()
  }

  async validSecondUploadStep (videoName: string) {
    const nameInput = $('input#name')
    await nameInput.clearValue()
    await nameInput.setValue(videoName)

    await this.getSecondStepSubmitButton().click()

    return browser.waitUntil(async () => {
      return (await browser.getUrl()).includes('/w/')
    })
  }

  setAsPublic () {
    return selectCustomSelect('privacy', 'Public')
  }

  private getSecondStepSubmitButton () {
    return $('.submit-container my-button')
  }
}
