import { browserSleep, findParentElement, go, setCheckboxEnabled } from '../utils'

export class AdminRegistrationPage {
  async navigateToRegistrationsList () {
    await go('/admin/moderation/registrations/list')

    await $('my-registration-list').waitForDisplayed()
  }

  async accept (username: string, moderationResponse: string, options: {
    preventEmailDelivery?: boolean
  } = {}) {
    const usernameEl = $('*=' + username)
    await usernameEl.waitForDisplayed()

    const tr = await findParentElement(usernameEl, async el => await el.getTagName() === 'tr')

    await tr.$('.action-cell .dropdown-root').click()

    const accept = $('span*=Accept')
    await accept.waitForClickable()
    await accept.click()

    const moderationResponseTextarea = $('#moderationResponse')
    await moderationResponseTextarea.waitForDisplayed()

    await moderationResponseTextarea.setValue(moderationResponse)

    if (options.preventEmailDelivery !== undefined) {
      await setCheckboxEnabled('preventEmailDelivery', options.preventEmailDelivery)
    }

    const submitButton = $('.modal-footer input[type=submit]')
    await submitButton.waitForClickable()
    await submitButton.click()

    await browserSleep(1000)
  }
}
