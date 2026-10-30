import { NSFWPolicyType } from '@peertube/peertube-models'
import { browserSleep, getCheckbox, go, selectCustomSelect } from '../utils'

export class MyAccountPage {
  navigateToMyPlaylists () {
    return this.clickOnMenuLink('/my-library/video-playlists')
  }

  navigateToMyHistory () {
    return this.clickOnMenuLink('/my-library/history/videos')
  }

  // ---------------------------------------------------------------------------
  // My account settings
  // ---------------------------------------------------------------------------

  navigateToMySettings () {
    return this.clickOnMenuLink('/my-account')
  }

  async updateNSFW (newValue: NSFWPolicyType) {
    const nsfw = $(`#nsfwPolicy-${newValue} + label`)

    await nsfw.waitForDisplayed()
    await nsfw.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await nsfw.waitForClickable()

    await nsfw.click()

    await this.submitSettings('my-user-sensitive-content-settings')
  }

  async updateViolentFlag (newValue: NSFWPolicyType) {
    const nsfw = $(`#nsfwFlagViolent-${newValue} + label`)

    await nsfw.waitForDisplayed()
    await nsfw.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await nsfw.waitForClickable()

    await nsfw.click()

    await this.submitSettings('my-user-sensitive-content-settings')
  }

  async clickOnP2PCheckbox () {
    const p2p = await getCheckbox('p2pEnabled')

    await p2p.waitForClickable()
    await p2p.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header

    await p2p.click()

    await this.submitSettings('my-user-player-settings')
  }

  private async submitSettings (componentSelector: string) {
    const submit = $(componentSelector + ' input[type=submit]')

    await submit.waitForClickable()
    await submit.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await submit.click()
  }

  async updateEmail (email: string, password: string) {
    const emailInput = $('my-account-change-email #new-email')
    await emailInput.waitForDisplayed()
    await emailInput.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await emailInput.setValue(email)

    const passwordInput = $('my-account-change-email #password')
    await passwordInput.waitForDisplayed()
    await passwordInput.setValue(password)

    const submit = $('my-account-change-email input[type=submit]')
    await submit.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await submit.waitForClickable()
    await submit.click()
  }

  // ---------------------------------------------------------------------------
  // My account playlists
  // ---------------------------------------------------------------------------

  async getPlaylistVideosText (name: string) {
    const elem = await this.getPlaylist(name)

    return elem.$('.miniature-playlist-info-overlay').getText()
  }

  async clickOnPlaylist (name: string) {
    const elem = await this.getPlaylist(name)

    return elem.$('.miniature-thumbnail').click()
  }

  async countTotalPlaylistElements () {
    await $('<my-video-playlist-element-miniature>').waitForDisplayed()

    return $$('<my-video-playlist-element-miniature>').length
  }

  playPlaylist () {
    return $('.playlist-info .miniature-thumbnail').click()
  }

  async goOnAssociatedPlaylistEmbed () {
    let url = await browser.getUrl()
    url = url.replace('/w/p/', '/video-playlists/embed/')
    url = url.replace(':3333', ':9001')

    return go(url)
  }

  async updatePlaylistPrivacy (playlistUUID: string, privacy: 'Public' | 'Private' | 'Unlisted') {
    await go('/my-library/video-playlists/update/' + playlistUUID)

    await $('a[href*="/my-library/video-playlists/update/"]').waitForDisplayed()

    await selectCustomSelect('videoChannelId', 'Main root channel')
    await selectCustomSelect('privacy', privacy)

    const submit = $('form input[type=submit]')
    await submit.waitForClickable()
    await submit.scrollIntoView()
    await submit.click()

    return browser.waitUntil(async () => {
      return (await browser.getUrl()).includes('my-library/video-playlists')
    })
  }

  private async clickOnMenuLink (href: string) {
    const link = $(`a[href="${href}"]`)

    // A pending redirect (home page) can override our navigation, so click again if needed
    await browser.waitUntil(async () => {
      await link.waitForClickable()
      await link.click()

      await browserSleep(500)

      return (await browser.getUrl()).includes(href)
    }, { timeout: 10000 })
  }

  private async getPlaylist (name: string) {
    const playlist = () => {
      return $$('my-video-playlist-miniature')
        .filter(async e => {
          const t = await e.$('img').getAttribute('aria-label')

          return t.includes(name)
        })
        .then(elems => elems[0])
    }

    await browser.waitUntil(async () => {
      const el = await playlist()

      return el?.isDisplayed()
    })

    return playlist()
  }
}
