import { join } from 'node:path'
import { VideoManage } from './video-manage'
import { FIXTURE_URLS } from '../utils'

export class VideoPublishPage extends VideoManage {
  async navigateTo (tab?: 'Go live') {
    const publishButton = $('.publish-button > a')

    await publishButton.waitForClickable()
    await publishButton.click()

    await $('.upload-video-container').waitForDisplayed()

    if (tab) {
      const el = $(`.nav-link*=${tab}`)
      await el.waitForClickable()
      await el.click()
    }
  }

  // ---------------------------------------------------------------------------

  async uploadVideo (fixtureName: 'video.mp4' | 'video2.mp4' | 'video3.mp4') {
    const fileToUpload = join(__dirname, '../../fixtures/' + fixtureName)
    const fileInputSelector = '.upload-video-container input[type=file]'
    const parentFileInput = '.upload-video-container .button-file'

    // Avoid sending keys on non visible element
    await browser.execute(`document.querySelector('${fileInputSelector}').style.opacity = 1`)
    await browser.execute(`document.querySelector('${parentFileInput}').style.overflow = 'initial'`)

    await browser.pause(1000)

    const elem = $(fileInputSelector)
    await elem.chooseFile(fileToUpload)

    // Wait for the upload to finish
    await this.getSaveButton().waitForClickable()
  }

  async importVideo () {
    const tab = $('.nav-link*=Import with URL')
    await tab.waitForClickable()
    await tab.click()

    const input = $('#targetUrl')
    await input.waitForDisplayed()
    await input.setValue(FIXTURE_URLS.IMPORT_URL)

    const submit = $('.first-step-block .primary-button:not([disabled])')
    await submit.waitForClickable()
    await submit.click()

    // Wait for the import to finish
    await this.getSaveButton().waitForClickable({ timeout: 15000 }) // Can be slow
  }

  async publishLive () {
    await $('#permanentLiveTrue').parentElement().click()

    const submit = $('.upload-video-container .primary-button:not([disabled])')
    await submit.waitForClickable()
    await submit.click()

    await this.getSaveButton().waitForClickable()
  }

  // ---------------------------------------------------------------------------

  async validSecondStep (videoName: string) {
    await this.goOnPage('Main information')

    const nameInput = $('input#name')
    await nameInput.scrollIntoView()
    await nameInput.clearValue()
    await nameInput.setValue(videoName)

    await this.clickOnSave()
  }
}
