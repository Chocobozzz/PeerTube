import { FIXTURE_URLS } from '../urls'
import { browserSleep, go } from '../utils'

export class VideoWatchPage {
  async goOnVideosList (isMobileDevice: boolean, isSafari: boolean) {
    let url: string

    // We did not upload a file on a mobile device
    if (isMobileDevice === true || isSafari === true) {
      url = 'https://peertube2.cpy.re/videos/local'
    } else {
      url = '/videos/recently-added'
    }

    await go(url)

    // Waiting the following element does not work on Safari...
    if (isSafari) return browserSleep(3000)

    await $('.videos .video-miniature .video-miniature-name').waitForDisplayed()
  }

  async getVideosListName () {
    const elems = await $$('.videos .video-miniature .video-miniature-name')
    const texts = await Promise.all(elems.map(e => e.getText()))

    return texts.map(t => t.trim())
  }

  waitWatchVideoName (videoName: string, isMobileDevice: boolean, isSafari: boolean) {
    if (isSafari) return browserSleep(5000)

    // On mobile we display the first node, on desktop the second
    const index = isMobileDevice ? 0 : 1

    return browser.waitUntil(async () => {
      return (await $$('.video-info .video-info-name')[index].getText()).includes(videoName)
    })
  }

  getVideoName () {
    return this.getVideoNameElement().then(e => e.getText())
  }

  async goOnAssociatedEmbed () {
    let url = await browser.getUrl()
    url = url.replace('/w/', '/videos/embed/')
    url = url.replace(':3333', ':9001')

    return go(url)
  }

  goOnP2PMediaLoaderEmbed () {
    return go(FIXTURE_URLS.HLS_EMBED)
  }

  goOnP2PMediaLoaderPlaylistEmbed () {
    return go(FIXTURE_URLS.HLS_PLAYLIST_EMBED)
  }

  async clickOnVideo (videoName: string) {
    const video = async () => {
      const videos = await $$('.videos .video-miniature .video-miniature-name').filter(async e => {
        const t = await e.getText()

        return t === videoName
      })

      return videos[0]
    }

    await browser.waitUntil(async () => {
      const elem = await video()

      return elem?.isClickable()
    });

    (await video()).click()

    await browser.waitUntil(async () => (await browser.getUrl()).includes('/w/'))
  }

  async clickOnFirstVideo () {
    const video = () => $('.videos .video-miniature .video-thumbnail')
    const videoName = () => $('.videos .video-miniature .video-miniature-name')

    await video().waitForClickable()

    const textToReturn = await videoName().getText()
    await video().click()

    await browser.waitUntil(async () => (await browser.getUrl()).includes('/w/'))

    return textToReturn
  }

  async clickOnUpdate () {
    const dropdown = $('my-video-actions-dropdown .action-button')
    await dropdown.click()

    await $('.dropdown-menu.show .dropdown-item').waitForDisplayed()
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
