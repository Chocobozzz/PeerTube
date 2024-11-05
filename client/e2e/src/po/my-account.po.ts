import { getCheckbox, go, selectCustomSelect } from '../utils'

export class MyAccountPage {

  navigateToMyVideos () {
    return $('a[href="/my-library/videos"]').click()
  }

  navigateToMyPlaylists () {
    return $('a[href="/my-library/video-playlists"]').click()
  }

  navigateToMyHistory () {
    return $('a[href="/my-library/history/videos"]').click()
  }

  // Settings

  navigateToMySettings () {
    return $('a[href="/my-account"]').click()
  }

  async updateNSFW (newValue: 'do_not_list' | 'blur' | 'display') {
    const nsfw = $('#nsfwPolicy')

    await nsfw.waitForDisplayed()
    await nsfw.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await nsfw.waitForClickable()

    await nsfw.selectByAttribute('value', newValue)

    await this.submitVideoSettings()
  }

  async clickOnP2PCheckbox () {
    const p2p = await getCheckbox('p2pEnabled')

    await p2p.waitForClickable()
    await p2p.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header

    await p2p.click()

    await this.submitVideoSettings()
  }

  private async submitVideoSettings () {
    const submit = $('my-user-video-settings input[type=submit]')

    await submit.waitForClickable()
    await submit.scrollIntoView({ block: 'center' }) // Avoid issues with fixed header
    await submit.click()
  }

  // My account Videos

  async removeVideo (name: string) {
    const container = await this.getVideoElement(name)

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
    const elements = await $$('.video').filter(async e => {
      const t = await e.$('.video-name').getText()

      return names.some(n => t.includes(n))
    })

    return elements.length
  }

  // My account playlists

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
    go('/my-library/video-playlists/update/' + playlistUUID)

    await $('a[href*="/my-library/video-playlists/update/"]').waitForDisplayed()

    await selectCustomSelect('videoChannelId', 'Main root channel')
    await selectCustomSelect('privacy', privacy)

    const submit = await $('form input[type=submit]')
    await submit.waitForClickable()
    await submit.scrollIntoView()
    await submit.click()

    return browser.waitUntil(async () => {
      return (await browser.getUrl()).includes('my-library/video-playlists')
    })
  }

  // My account Videos

  private async getVideoElement (name: string) {
    const video = async () => {
      const videos = await $$('.video').filter(async e => {
        const t = await e.$('.video-name').getText()

        return t.includes(name)
      })

      return videos[0]
    }

    await browser.waitUntil(async () => {
      return (await video()).isDisplayed()
    })

    return video()
  }

  // My account playlists

  private async getPlaylist (name: string) {
    const playlist = () => {
      return $$('my-video-playlist-miniature')
        .filter(async e => {
          const t = await e.$('.miniature-name').getText()

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
