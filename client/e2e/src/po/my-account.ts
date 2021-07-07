import { by, element, browser } from 'protractor'

export class MyAccountPage {

  navigateToMyVideos () {
    return element(by.css('a[href="/my-library/videos"]')).click()
  }

  navigateToMyPlaylists () {
    return element(by.css('a[href="/my-library/video-playlists"]')).click()
  }

  navigateToMyHistory () {
    return element(by.css('a[href="/my-library/history/videos"]')).click()
  }

  // My account Videos

  async removeVideo (name: string) {
    const container = this.getVideoElement(name)

    await container.element(by.css('.dropdown-toggle')).click()

    const dropdownMenu = container.element(by.css('.dropdown-menu .dropdown-item:nth-child(2)'))
    await browser.wait(browser.ExpectedConditions.presenceOf(dropdownMenu))

    return dropdownMenu.click()
  }

  validRemove () {
    return element(by.css('input[type=submit]')).click()
  }

  countVideos (names: string[]) {
    return element.all(by.css('.video'))
                  .filter(e => {
                    return e.element(by.css('.video-miniature-name'))
                            .getText()
                            .then(t => names.some(n => t.includes(n)))
                  })
                  .count()
  }

  // My account playlists

  getPlaylistVideosText (name: string) {
    return this.getPlaylist(name).element(by.css('.miniature-playlist-info-overlay')).getText()
  }

  clickOnPlaylist (name: string) {
    return this.getPlaylist(name).element(by.css('.miniature-thumbnail')).click()
  }

  countTotalPlaylistElements () {
    return element.all(by.css('my-video-playlist-element-miniature')).count()
  }

  playPlaylist () {
    return element(by.css('.playlist-info .miniature-thumbnail')).click()
  }

  async goOnAssociatedPlaylistEmbed () {
    let url = await browser.getCurrentUrl()
    url = url.replace('/w/p/', '/video-playlists/embed/')
    url = url.replace(':3333', ':9001')

    return browser.get(url)
  }

  // My account Videos

  private getVideoElement (name: string) {
    return element.all(by.css('.video'))
                  .filter(e => e.element(by.css('.video-miniature-name')).getText().then(t => t.includes(name)))
                  .first()
  }

  // My account playlists

  private getPlaylist (name: string) {
    return element.all(by.css('my-video-playlist-miniature'))
      .filter(e => e.element(by.css('.miniature-name')).getText().then(t => t.includes(name)))
      .first()
  }
}
