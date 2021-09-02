import { go } from '../utils'

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

  // My account Videos

  async removeVideo (name: string) {
    const container = await this.getVideoElement(name)

    await container.$('.dropdown-toggle').click()

    const dropdownMenu = () => container.$('.dropdown-menu .dropdown-item:nth-child(2)')

    await dropdownMenu().waitForDisplayed()
    return dropdownMenu().click()
  }

  validRemove () {
    return $('input[type=submit]').click()
  }

  async countVideos (names: string[]) {
    const elements = await $$('.video').filter(async e => {
      const t = await e.$('.video-miniature-name').getText()

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

  // My account Videos

  private async getVideoElement (name: string) {
    const video = async () => {
      const videos = await $$('.video').filter(async e => {
        const t = await e.$('.video-miniature-name').getText()

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
