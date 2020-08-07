import { browser, by, element, ElementFinder, ExpectedConditions } from 'protractor'
import { browserSleep, isMobileDevice } from '../utils'

export class VideoWatchPage {
  async goOnVideosList (isMobileDevice: boolean, isSafari: boolean) {
    let url: string

    // We did not upload a file on a mobile device
    if (isMobileDevice === true || isSafari === true) {
      url = 'https://peertube2.cpy.re/videos/local'
    } else {
      url = '/videos/recently-added'
    }

    await browser.get(url, 20000)

    // Waiting the following element does not work on Safari...
    if (isSafari) return browserSleep(3000)

    const elem = element.all(by.css('.videos .video-miniature .video-miniature-name')).first()
    return browser.wait(browser.ExpectedConditions.visibilityOf(elem))
  }

  getVideosListName () {
    return element.all(by.css('.videos .video-miniature .video-miniature-name'))
                  .getText()
                  .then((texts: any) => texts.map((t: any) => t.trim()))
  }

  waitWatchVideoName (videoName: string, isMobileDevice: boolean, isSafari: boolean) {
    if (isSafari) return browserSleep(5000)

    // On mobile we display the first node, on desktop the second
    const index = isMobileDevice ? 0 : 1

    const elem = element.all(by.css('.video-info .video-info-name')).get(index)
    return browser.wait(browser.ExpectedConditions.textToBePresentInElement(elem, videoName))
  }

  getVideoName () {
    return this.getVideoNameElement().getText()
  }

  async goOnAssociatedEmbed () {
    let url = await browser.getCurrentUrl()
    url = url.replace('/watch/', '/embed/')
    url = url.replace(':3333', ':9001')

    return browser.get(url)
  }

  async goOnP2PMediaLoaderEmbed () {
    return browser.get('https://peertube2.cpy.re/videos/embed/969bf103-7818-43b5-94a0-de159e13de50')
  }

  async goOnP2PMediaLoaderPlaylistEmbed () {
    return browser.get('https://peertube2.cpy.re/video-playlists/embed/73804a40-da9a-40c2-b1eb-2c6d9eec8f0a')
  }

  async clickOnVideo (videoName: string) {
    const video = element.all(by.css('.videos .video-miniature .video-miniature-name'))
    .filter(e => e.getText().then(t => t === videoName ))
    .first()

    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))
    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
  }

  async clickOnFirstVideo () {
    const video = element.all(by.css('.videos .video-miniature .video-thumbnail')).first()
    const videoName = element.all(by.css('.videos .video-miniature .video-miniature-name')).first()

    // Don't know why but the expectation fails on Safari
    await browser.wait(browser.ExpectedConditions.elementToBeClickable(video))

    const textToReturn = videoName.getText()
    await video.click()

    await browser.wait(browser.ExpectedConditions.urlContains('/watch/'))
    return textToReturn
  }

  async clickOnUpdate () {
    const dropdown = element(by.css('my-video-actions-dropdown .action-button'))
    await dropdown.click()

    const items: ElementFinder[] = await element.all(by.css('my-video-actions-dropdown .dropdown-menu .dropdown-item'))

    for (const item of items) {
      const href = await item.getAttribute('href')

      if (href && href.includes('/update/')) {
        await item.click()
        return
      }
    }
  }

  async clickOnSave () {
    return element(by.css('.action-button-save')).click()
  }

  async createPlaylist (name: string) {
    await element(by.css('.new-playlist-button')).click()

    await element(by.css('#displayName')).sendKeys(name)

    return element(by.css('.new-playlist-block input[type=submit]')).click()
  }

  async saveToPlaylist (name: string) {
    return element.all(by.css('my-video-add-to-playlist .playlist'))
                  .filter(p => p.getText().then(t => t === name))
                  .click()
  }

  waitUntilVideoName (name: string, maxTime: number) {
    const elem = this.getVideoNameElement()

    return browser.wait(ExpectedConditions.textToBePresentInElement(elem, name), maxTime)
  }

  private getVideoNameElement () {
    // We have 2 video info name block, pick the first that is not empty
    return element.all(by.css('.video-info-first-row .video-info-name'))
                  .filter(e => e.getText().then(t => !!t))
                  .first()
  }
}
