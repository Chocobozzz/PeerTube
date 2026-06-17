export class MyVideosPage {
  navigateToMyVideos () {
    return $('a[href="/my-library/videos"]').click()
  }

  async selectVideoRow (videoName: string) {
    const row = await this.getVideoRow(videoName)

    const checkbox = row.$('.checkbox-cell')
    await checkbox.waitForClickable()
    await checkbox.click()
  }

  async selectAllVideos () {
    const headerCheckbox = $('p-tableHeaderCheckbox')
    await headerCheckbox.waitForClickable()
    await headerCheckbox.click()
  }

  async removeVideo (name: string) {
    const container = await this.getVideoRow(name)

    await container.$('my-action-dropdown .dropdown-toggle').click()

    const deleteItem = () => {
      return $$('.dropdown-menu .dropdown-item').find<WebdriverIO.Element>(async v => {
        const text = await v.getText()

        return text.includes('Delete')
      })
    }

    await (await deleteItem()).waitForClickable()

    return (await deleteItem()).click()
  }

  validRemove () {
    return $('input[type=submit]').click()
  }

  async countVideos (names: string[]) {
    const elements = await $$('.video-cell-name .name').filter(async e => {
      const t = await e.getText()

      return names.some(n => t.includes(n))
    })

    return elements.length
  }

  async getVideoRow (name: string) {
    let el = $('.name*=' + name)

    await el.waitForDisplayed()

    while (await el.getTagName() !== 'tr') {
      el = el.parentElement()
    }

    return el
  }

  async clickOnManage (videoName: string) {
    const row = await this.getVideoRow(videoName)

    const manageButtons = await row.$$('my-button a').filter(async a => {
      const text = await a.getText()
      return text.trim() === 'Manage'
    })

    const manageButton = manageButtons[0]
    await manageButton.waitForClickable()
    await manageButton.click()
  }
}
