import { browserSleep, getCheckbox } from '../utils'

export class BulkUpdatePage {
  async openBulkUpdate () {
    const batchActions = $('my-action-dropdown[label="Batch actions"]')
    await batchActions.waitForDisplayed()

    const toggle = batchActions.$('.dropdown-toggle')
    await toggle.waitForClickable()
    await toggle.click()

    const updateItem = await this.getActionItem('Update')
    await updateItem.waitForClickable()
    await updateItem.click()
  }

  async addField (fieldKey: string) {
    const select = $('.bulk-update-add-field select')
    await select.waitForDisplayed()
    await select.selectByAttribute('value', fieldKey)
    await browserSleep(500)
  }

  async setDownloadEnabled (enabled: boolean) {
    const checkbox = await getCheckbox('bulk-downloadEnabled')
    await checkbox.waitForClickable()

    const input = checkbox.$('input')
    const isChecked = await input.isSelected()

    if (isChecked !== enabled) {
      await checkbox.click()
    }
  }

  async setSupport (text: string) {
    const textarea = $('.bulk-update-field-section textarea')
    await textarea.waitForDisplayed()
    await textarea.setValue(text)
  }

  async clickNext () {
    const btn = await this.getButtonByLabel('Next')
    await btn.waitForClickable()
    await btn.click()
  }

  async clickBack () {
    const btn = $('input[value="Back"]')
    await btn.waitForClickable()
    await btn.click()
  }

  async clickUpdate () {
    const btn = await this.getButtonByLabel('Update')
    await btn.waitForClickable()
    await btn.click()
  }

  async waitForConfigureStep () {
    const nextBtn = await this.getButtonByLabel('Next')
    await nextBtn.waitForDisplayed()
  }

  async waitForConfirmStep () {
    const updateBtn = await this.getButtonByLabel('Update')
    await updateBtn.waitForDisplayed()

    const backBtn = $('input[value="Back"]')
    await backBtn.waitForDisplayed()
  }

  async getConfirmSummaryText () {
    const modalBody = $('.modal-body')
    await modalBody.waitForDisplayed()

    return modalBody.getText()
  }

  async closeModal () {
    const closeBtn = $('.modal-header .border-0')
    await closeBtn.waitForClickable()
    await closeBtn.click()
  }

  // ---------------------------------------------------------------------------

  private async getButtonByLabel (label: string) {
    const buttons = await $$('my-button button.action-button').filter(async b => {
      const text = await b.getText()

      return text.trim() === label
    })

    return buttons[0]
  }

  private async getActionItem (label: string) {
    const items = await $$('span.custom-action.dropdown-item').filter(async i => {
      const text = await i.getText()

      return text.includes(label)
    })

    return items[0]
  }
}
