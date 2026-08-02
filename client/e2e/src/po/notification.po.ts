import { go } from '../utils'

export class NotificationPage {
  async navigateTo () {
    await go('/my-account/notifications')

    await $('my-user-notifications').waitForDisplayed()
  }

  async acceptChannelCollaborationInvitation (channelDisplayName: string) {
    const notification = await this.getNotification(channelDisplayName)
    const acceptButton = notification.$('button*=Accept')

    await acceptButton.waitForClickable()
    await acceptButton.click()

    await browser.waitUntil(async () => {
      const url = await browser.getUrl()

      return url.includes('/video-channels/manage/')
    })

    await $('.header-block').$('*=' + channelDisplayName).waitForDisplayed()
  }

  private async getNotification (channelDisplayName: string) {
    let notification: WebdriverIO.Element

    await browser.waitUntil(async () => {
      return $$('.notifications .notification').some(async el => {
        if ((await el.getText()).includes(channelDisplayName)) {
          notification = el
          return true
        }

        return false
      })
    })

    if (!notification) {
      throw new Error(`Cannot find channel collaboration notification for ${channelDisplayName}`)
    }

    return notification
  }
}
