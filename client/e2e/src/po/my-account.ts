import { by, element } from 'protractor'

export class MyAccountPage {

  navigateToMyVideos () {
    return element(by.css('a[href="/my-account/videos"]')).click()
  }

  navigateToMyPlaylists () {
    return element(by.css('a[href="/my-account/video-playlists"]')).click()
  }

  navigateToMyHistory () {
    return element(by.css('a[href="/my-account/history/videos"]')).click()
  }

  // My account Videos

  getLastVideoName () {
    return this.getAllVideoNameElements().first().getText()
  }

  removeLastVideo () {
    return this.getLastVideoElement().element(by.css('my-delete-button')).click()
  }

  validRemove () {
    return element(by.css('.action-button-submit')).click()
  }

  countVideos () {
    return this.getAllVideoNameElements().count()
  }

  // My account playlists

  getLastUpdatedPlaylistName () {
    return this.getLastUpdatedPlaylist().element(by.css('.miniature-name')).getText()
  }

  getLastUpdatedPlaylistVideosText () {
    return this.getLastUpdatedPlaylist().element(by.css('.miniature-playlist-info-overlay')).getText()
  }

  clickOnLastUpdatedPlaylist () {
    return this.getLastUpdatedPlaylist().element(by.css('.miniature-thumbnail')).click()
  }

  countTotalPlaylistElements () {
    return element.all(by.css('my-video-playlist-element-miniature')).count()
  }

  playPlaylist () {
    return element(by.css('.playlist-info .miniature-thumbnail')).click()
  }

  // My account Videos

  private getLastVideoElement () {
    return element.all(by.css('.video')).first()
  }

  private getAllVideoNameElements () {
    return element.all(by.css('.video-miniature-name'))
  }

  // My account playlists

  private getLastUpdatedPlaylist () {
    return element.all(by.css('my-video-playlist-miniature')).first()
  }
}
