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

  async validRemove () {
    const submit = $('.modal.show .modal-footer input[type=submit]')
    await submit.waitForClickable()

    return submit.click()
  }

  async countVideos (names: string[]) {
    // Get texts in a single call: the list can be rendered again while we iterate over the elements
    const texts = await browser.execute(() => {
      return Array.from(document.querySelectorAll('.video-cell-name .name')).map(e => e.textContent)
    })

    return texts.filter(t => names.some(n => t.includes(n))).length
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
