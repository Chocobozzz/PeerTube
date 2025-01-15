import { join } from 'path'
import { getCheckbox, selectCustomSelect } from '../utils'

export class VideoUploadPage {
  async navigateTo () {
    const publishButton = await $('.publish-button > a')

    await publishButton.waitForClickable()
    await publishButton.click()

    await $('.upload-video-container').waitForDisplayed()
  }

  async uploadVideo (fixtureName: 'video.mp4' | 'video2.mp4' | 'video3.mp4') {
    const fileToUpload = join(__dirname, '../../fixtures/' + fixtureName)
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
      const progress = await $('.progress-container=100%').isDisplayed()

      return !warning && progress
    })
  }

  async setAsNSFW () {
    const checkbox = await getCheckbox('nsfw')
    await checkbox.waitForClickable()

    return checkbox.click()
  }

  async validSecondUploadStep (videoName: string) {
    const nameInput = $('input#name')
    await nameInput.clearValue()
    await nameInput.setValue(videoName)

    const button = this.getSecondStepSubmitButton()
    await button.waitForClickable()

    await button.click()

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

  async setAsPasswordProtected (videoPassword: string) {
    selectCustomSelect('privacy', 'Password protected')

    const videoPasswordInput = $('input#videoPassword')
    await videoPasswordInput.waitForClickable()
    await videoPasswordInput.clearValue()

    return videoPasswordInput.setValue(videoPassword)
  }

  private getSecondStepSubmitButton () {
    return $('.submit-container my-button')
  }
}
