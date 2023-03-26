import { browserSleep, findParentElement, go } from '../utils'

export class AdminRegistrationPage {

  async navigateToRegistratonsList () {
    await go('/admin/moderation/registrations/list')

    await $('my-registration-list').waitForDisplayed()
  }

  async accept (username: string, moderationResponse: string) {
    const usernameEl = await $('*=' + username)
    await usernameEl.waitForDisplayed()

    const tr = await findParentElement(usernameEl, async el => await el.getTagName() === 'tr')

    await tr.$('.action-cell .dropdown-root').click()

    const accept = await $('span*=Accept this request')
    await accept.waitForClickable()
    await accept.click()

    const moderationResponseTextarea = await $('#moderationResponse')
    await moderationResponseTextarea.waitForDisplayed()

    await moderationResponseTextarea.setValue(moderationResponse)

    const submitButton = $('.modal-footer input[type=submit]')
    await submitButton.waitForClickable()
    await submitButton.click()

    await browserSleep(1000)
  }

}
