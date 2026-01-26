import { browserSleep, FIXTURE_URLS, go } from '../utils'

export class VideoWatchPage {
  constructor (private isMobileDevice: boolean, private isSafari: boolean) {
  }

  waitWatchVideoName (videoName: string, maxTime?: number) {
    if (this.isSafari) return browserSleep(5000)

    // On mobile we display the first node, on desktop the second one
    return browser.waitUntil(async () => {
      return (await this.getVideoName()) === videoName
    }, { timeout: maxTime })
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
    try {
      await this.clickOnMoreDropdownIcon()

      return await $('.dropdown-item .icon-download').isExisting()
    } catch {
      return $('.action-button-download').isDisplayed()
    }
  }

  areCommentsEnabled () {
    return $('my-video-comment-add').isExisting()
  }

  isPrivacyWarningDisplayed () {
    return $('.privacy-concerns-text').isDisplayed()
  }

  async goOnAssociatedEmbed (passwordProtected = false) {
    let url = await browser.getUrl()
    url = url.replace('/w/', '/videos/embed/')
    url = url.replace(':3333', ':9001')

    await go(url)

    if (passwordProtected) await this.waitEmbedForVideoPasswordForm()
    else await this.waitEmbedForDisplayed()
  }

  waitEmbedForDisplayed () {
    return $('.vjs-big-play-button').waitForDisplayed()
  }

  waitEmbedForVideoPasswordForm () {
    return $('#video-password-input').waitForDisplayed()
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

  getModalTitleEl () {
    return $('.modal-content .modal-title')
  }

  confirmModal () {
    return $('.modal-content .modal-footer .primary-button').click()
  }

  private getVideoNameElement () {
    return $('.video-info-first-row .video-info-name')
  }

  // ---------------------------------------------------------------------------
  // Video password
  // ---------------------------------------------------------------------------

  async fillVideoPassword (videoPassword: string) {
    const videoPasswordInput = $('input#confirmInput')
    await videoPasswordInput.waitForClickable()
    await videoPasswordInput.clearValue()
    await videoPasswordInput.setValue(videoPassword)

    const confirmButton = $('input[value="Confirm"]')
    await confirmButton.waitForClickable()
    return confirmButton.click()
  }

  // ---------------------------------------------------------------------------
  // Video actions
  // ---------------------------------------------------------------------------

  async like () {
    const likeButton = $('.action-button-like')
    const isActivated = (await likeButton.getAttribute('class')).includes('activated')

    let count: number
    try {
      count = parseInt(await $('.action-button-like > .count').getText())
    } catch (error) {
      count = 0
    }

    await likeButton.waitForClickable()
    await likeButton.click()

    if (isActivated) {
      if (count === 1) {
        return expect(!await $('.action-button-like > .count').isExisting())
      } else {
        return expect(parseInt(await $('.action-button-like > .count').getText())).toBe(count - 1)
      }
    } else {
      return expect(parseInt(await $('.action-button-like > .count').getText())).toBe(count + 1)
    }
  }

  async clickOnManage () {
    await this.clickOnMoreDropdownIcon()

    // We need the await expression
    return $$('.dropdown-menu.show .dropdown-item').forEach(async item => {
      const content = await item.getText()

      if (content.includes('Manage')) {
        await item.click()
        await $('#name').waitForClickable()
        return
      }
    })
  }

  async clickOnMoreDropdownIcon () {
    const dropdown = $('my-video-actions-dropdown .action-button')
    await dropdown.scrollIntoView({ block: 'center' })
    await dropdown.click()

    await $('.dropdown-menu.show .dropdown-item').waitForDisplayed()
  }

  // ---------------------------------------------------------------------------
  // Playlists
  // ---------------------------------------------------------------------------

  async clickOnSave () {
    const button = $('.action-button-save')

    await button.scrollIntoView({ block: 'center' })

    return button.click()
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

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  async createThread (comment: string) {
    const textarea = $('my-video-comment-add textarea')
    await textarea.waitForClickable()

    await textarea.setValue(comment)

    const confirmButton = $('.comment-buttons .primary-button')
    await confirmButton.waitForClickable()
    await confirmButton.click()

    const createdComment = await $('.comment-html p').getText()

    return expect(createdComment).toBe(comment)
  }

  async createReply (comment: string) {
    const replyButton = $('button.comment-action-reply')
    await replyButton.waitForClickable()
    await replyButton.scrollIntoView({ block: 'center' })
    await replyButton.click()

    const textarea = $('my-video-comment my-video-comment-add textarea')
    await textarea.waitForClickable()
    await textarea.setValue(comment)

    const confirmButton = $('my-video-comment .comment-buttons .primary-button')
    await confirmButton.waitForClickable()
    await replyButton.scrollIntoView({ block: 'center' })
    await confirmButton.click()

    const createdComment = $('.is-child .comment-html p')
    await createdComment.waitForDisplayed()

    return expect(await createdComment.getText()).toBe(comment)
  }
}
