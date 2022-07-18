import { join } from 'path'
import { getCheckbox, selectCustomSelect } from '../utils'

export class VideoUploadPage {
  async navigateTo () {
    const publishButton = await $('.root-header .publish-button')

    await publishButton.waitForClickable()
    await publishButton.click()

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
      const warning = await $('=Publish will be available when upload is finished').isDisplayed()
      const progress = await $('.progress-bar=100%').isDisplayed()

      return !warning && progress
    })
  }

  async setAsNSFW () {
    const checkbox = await getCheckbox('nsfw')

    return checkbox.click()
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

  setAsPrivate () {
    return selectCustomSelect('privacy', 'Private')
  }

  private getSecondStepSubmitButton () {
    return $('.submit-container my-button')
  }
}
