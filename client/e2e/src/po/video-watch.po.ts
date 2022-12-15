import { browserSleep, FIXTURE_URLS, go } from '../utils'

export class VideoWatchPage {

  constructor (private isMobileDevice: boolean, private isSafari: boolean) {

  }

  waitWatchVideoName (videoName: string) {
    if (this.isSafari) return browserSleep(5000)

    // On mobile we display the first node, on desktop the second
    const index = this.isMobileDevice ? 0 : 1

    return browser.waitUntil(async () => {
      return (await $$('.video-info .video-info-name')[index].getText()).includes(videoName)
    })
  }

  getVideoName () {
    return this.getVideoNameElement().then(e => e.getText())
  }

  getPrivacy () {
    return $('.attribute-privacy .attribute-value').getText()
  }

  getLicence () {
    return $('.attribute-licence .attribute-value').getText()
  }

  async isDownloadEnabled () {
    await this.clickOnMoreDropdownIcon()

    return $('.dropdown-item .icon-download').isExisting()
  }

  areCommentsEnabled () {
    return $('my-video-comment-add').isExisting()
  }

  isPrivacyWarningDisplayed () {
    return $('my-privacy-concerns').isDisplayed()
  }

  async goOnAssociatedEmbed () {
    let url = await browser.getUrl()
    url = url.replace('/w/', '/videos/embed/')
    url = url.replace(':3333', ':9001')

    await go(url)
    await this.waitEmbedForDisplayed()
  }

  waitEmbedForDisplayed () {
    return $('.vjs-big-play-button').waitForDisplayed()
  }

  isEmbedWarningDisplayed () {
    return $('.peertube-dock-description').isDisplayed()
  }

  goOnP2PMediaLoaderEmbed () {
    return go(FIXTURE_URLS.HLS_EMBED)
  }

  goOnP2PMediaLoaderPlaylistEmbed () {
    return go(FIXTURE_URLS.HLS_PLAYLIST_EMBED)
  }

  async clickOnUpdate () {
    await this.clickOnMoreDropdownIcon()

    const items = await $$('.dropdown-menu.show .dropdown-item')

    for (const item of items) {
      const href = await item.getAttribute('href')

      if (href?.includes('/update/')) {
        await item.click()
        return
      }
    }
  }

  clickOnSave () {
    return $('.action-button-save').click()
  }

  async createPlaylist (name: string) {
    const newPlaylistButton = () => $('.new-playlist-button')

    await newPlaylistButton().waitForClickable()
    await newPlaylistButton().click()

    const displayName = () => $('#displayName')

    await displayName().waitForDisplayed()
    await displayName().setValue(name)

    return $('.new-playlist-block input[type=submit]').click()
  }

  async saveToPlaylist (name: string) {
    const playlist = () => $('my-video-add-to-playlist').$(`.playlist=${name}`)

    await playlist().waitForDisplayed()

    return playlist().click()
  }

  waitUntilVideoName (name: string, maxTime: number) {
    return browser.waitUntil(async () => {
      return (await this.getVideoName()) === name
    }, { timeout: maxTime })
  }

  async clickOnMoreDropdownIcon () {
    const dropdown = $('my-video-actions-dropdown .action-button')
    await dropdown.click()

    await $('.dropdown-menu.show .dropdown-item').waitForDisplayed()
  }

  private async getVideoNameElement () {
    // We have 2 video info name block, pick the first that is not empty
    const elem = async () => {
      const elems = await $$('.video-info-first-row .video-info-name').filter(e => e.isDisplayed())

      return elems[0]
    }

    await browser.waitUntil(async () => {
      const e = await elem()

      return e?.isDisplayed()
    })

    return elem()
  }
}
