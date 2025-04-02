import { clickOnRadio, getCheckbox, go, isRadioSelected, selectCustomSelect } from '../utils'

export abstract class VideoManage {
  async clickOnSave () {
    const button = this.getSaveButton()
    await button.waitForClickable()
    await button.click()

    await this.waitForSaved()
  }

  async clickOnWatch () {
    // Simulate the click, because the button opens a new tab
    const button = $('.watch-save > my-button[icon=external-link] a')
    await button.waitForClickable()

    await go(await button.getAttribute('href'))
  }

  // ---------------------------------------------------------------------------

  async setAsNSFW () {
    await this.goOnPage('Moderation')

    const checkbox = await getCheckbox('nsfw')
    await checkbox.waitForClickable()

    return checkbox.click()
  }

  // ---------------------------------------------------------------------------

  async setAsPublic () {
    await this.goOnPage('Main information')

    return selectCustomSelect('privacy', 'Public')
  }

  async setAsPrivate () {
    await this.goOnPage('Main information')

    return selectCustomSelect('privacy', 'Private')
  }

  async setAsPasswordProtected (videoPassword: string) {
    await this.goOnPage('Main information')

    selectCustomSelect('privacy', 'Password protected')

    const videoPasswordInput = $('input#videoPassword')
    await videoPasswordInput.waitForClickable()
    await videoPasswordInput.clearValue()

    return videoPasswordInput.setValue(videoPassword)
  }

  // ---------------------------------------------------------------------------

  async scheduleUpload () {
    await this.goOnPage('Main information')

    selectCustomSelect('privacy', 'Scheduled')

    const input = this.getScheduleInput()
    await input.waitForClickable()
    await input.click()

    const nextDay = $('.p-datepicker-today + td > span')
    await nextDay.waitForClickable()
    await nextDay.click()
    await nextDay.waitForDisplayed({ reverse: true })
  }

  getScheduleInput () {
    return $('#schedulePublicationAt input')
  }

  // ---------------------------------------------------------------------------

  async setNormalLive () {
    await this.goOnPage('Live settings')

    await clickOnRadio('permanentLiveFalse')
  }

  async setPermanentLive () {
    await this.goOnPage('Live settings')

    await clickOnRadio('permanentLiveTrue')
  }

  async getLiveState () {
    await this.goOnPage('Live settings')

    if (await isRadioSelected('#permanentLiveTrue')) return 'permanent'

    return 'normal'
  }

  // ---------------------------------------------------------------------------

  async refresh (videoName: string) {
    await browser.refresh()
    await browser.waitUntil(async () => {
      const url = await browser.getUrl()

      return url.includes('/videos/manage')
    })

    await browser.waitUntil(async () => {
      return await $('#name').getValue() === videoName
    })
  }

  // ---------------------------------------------------------------------------

  protected getSaveButton () {
    return $('.save-button > button:not([disabled])')
  }

  protected waitForSaved () {
    return $('.save-button > button[disabled], my-manage-errors').waitForDisplayed()
  }

  protected async goOnPage (page: 'Main information' | 'Moderation' | 'Live settings') {
    const el = $('my-video-manage-container .menu').$('*=' + page)
    await el.waitForClickable()
    await el.click()
  }
}
