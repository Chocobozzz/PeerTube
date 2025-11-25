import { NSFWPolicyType } from '@peertube/peertube-models'
import { AdminConfigPage } from '../po/admin-config.po'
import { AdminUserPage } from '../po/admin-user.po'
import { AnonymousSettingsPage } from '../po/anonymous-settings.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { PlayerPage } from '../po/player.po'
import { VideoListPage } from '../po/video-list.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoSearchPage } from '../po/video-search.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { getScreenshotPath, go, isMobileDevice, isSafari, prepareWebBrowser, waitServerUp } from '../utils'

describe('NSFW', () => {
  let videoListPage: VideoListPage
  let videoPublishPage: VideoPublishPage
  let adminConfigPage: AdminConfigPage
  let loginPage: LoginPage
  let adminUserPage: AdminUserPage
  let myAccountPage: MyAccountPage
  let videoSearchPage: VideoSearchPage
  let videoWatchPage: VideoWatchPage
  let playerPage: PlayerPage
  let anonymousSettingsPage: AnonymousSettingsPage

  const seed = Math.random()
  const nsfwVideo = seed + ' - nsfw'
  const violentVideo = seed + ' - violent'
  const normalVideo = seed + ' - normal'

  let videoUrl: string

  async function checkVideo (options: {
    policy: NSFWPolicyType
    videoName: string
    nsfwTooltip?: string
  }) {
    const { policy, videoName, nsfwTooltip } = options

    if (policy === 'do_not_list') {
      expect(await videoListPage.isVideoDisplayed(videoName)).toBeFalsy()
    } else if (policy === 'warn') {
      expect(await videoListPage.isVideoDisplayed(videoName)).toBeTruthy()
      expect(await videoListPage.isVideoBlurred(videoName)).toBeFalsy()
      expect(await videoListPage.hasVideoWarning(videoName)).toBeTruthy()
    } else if (policy === 'blur') {
      expect(await videoListPage.isVideoDisplayed(videoName)).toBeTruthy()
      expect(await videoListPage.isVideoBlurred(videoName)).toBeTruthy()
      expect(await videoListPage.hasVideoWarning(videoName)).toBeTruthy()
    } else { // Display
      expect(await videoListPage.isVideoDisplayed(videoName)).toBeTruthy()
      expect(await videoListPage.isVideoBlurred(videoName)).toBeFalsy()
      expect(await videoListPage.hasVideoWarning(videoName)).toBeFalsy()
    }

    if (nsfwTooltip) {
      await videoListPage.expectVideoNSFWTooltip(videoName, nsfwTooltip)
    }
  }

  async function checkFilterText (policy: NSFWPolicyType) {
    const pagesWithFilters = [
      videoListPage.goOnRootAccount.bind(videoListPage),
      videoListPage.goOnBrowseVideos.bind(videoListPage),
      videoListPage.goOnRootChannel.bind(videoListPage)
    ]

    for (const goOnPage of pagesWithFilters) {
      await goOnPage()

      const filterText = await videoListPage.getNSFWFilterText()

      if (policy === 'do_not_list') {
        expect(filterText).toContain('hidden')
      } else if (policy === 'warn') {
        expect(filterText).toContain('warned')
      } else if (policy === 'blur') {
        expect(filterText).toContain('blurred')
      } else {
        expect(filterText).toContain('displayed')
      }
    }
  }

  async function checkCommonVideoListPages (policy: NSFWPolicyType, videos: string[], nsfwTooltip?: string) {
    const pages = [
      videoListPage.goOnRootAccount.bind(videoListPage),
      videoListPage.goOnBrowseVideos.bind(videoListPage),
      videoListPage.goOnRootChannel.bind(videoListPage),
      videoListPage.goOnRootAccountChannels.bind(videoListPage),
      videoListPage.goOnHomepage.bind(videoListPage)
    ]

    for (const goOnPage of pages) {
      await goOnPage()

      for (const video of videos) {
        await browser.saveScreenshot(getScreenshotPath('before-nsfw-test.png'))
        await checkVideo({ policy, videoName: video, nsfwTooltip })
      }
    }

    for (const video of videos) {
      await videoSearchPage.search(video)

      await browser.saveScreenshot(getScreenshotPath('before-nsfw-test.png'))
      await checkVideo({ policy, videoName: video, nsfwTooltip })
    }
  }

  async function updateAdminNSFW (nsfw: NSFWPolicyType) {
    await adminConfigPage.updateNSFWSetting(nsfw)
    await adminConfigPage.save()
  }

  async function updateUserNSFW (nsfw: NSFWPolicyType, loggedIn: boolean) {
    if (loggedIn) {
      await myAccountPage.navigateToMySettings()
      await myAccountPage.updateNSFW(nsfw)

      return
    }

    await anonymousSettingsPage.openSettings()
    await anonymousSettingsPage.updateNSFW(nsfw)
    await anonymousSettingsPage.closeSettings()
  }

  async function updateUserViolentNSFW (nsfw: NSFWPolicyType, loggedIn: boolean) {
    if (loggedIn) {
      await myAccountPage.navigateToMySettings()
      await myAccountPage.updateViolentFlag(nsfw)

      return
    }

    await anonymousSettingsPage.openSettings()
    await anonymousSettingsPage.updateViolentFlag(nsfw)
    await anonymousSettingsPage.closeSettings()
  }

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    videoListPage = new VideoListPage(isMobileDevice(), isSafari())
    adminConfigPage = new AdminConfigPage()
    loginPage = new LoginPage(isMobileDevice())
    adminUserPage = new AdminUserPage()
    videoPublishPage = new VideoPublishPage()
    myAccountPage = new MyAccountPage()
    videoSearchPage = new VideoSearchPage()
    playerPage = new PlayerPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())
    anonymousSettingsPage = new AnonymousSettingsPage()

    await prepareWebBrowser()
  })

  describe('Preparation', function () {
    it('Should login and disable NSFW', async () => {
      await loginPage.loginAsRootUser()
      await updateUserNSFW('display', true)
    })

    it('Should set the homepage', async () => {
      await adminConfigPage.updateHomepage('<peertube-videos-list data-sort="-publishedAt"></peertube-videos-list>')
      await adminConfigPage.save()
    })

    it('Should create a user', async () => {
      await adminUserPage.createUser({
        username: 'user_' + seed,
        password: 'superpassword'
      })
    })

    it('Should upload NSFW and normal videos', async () => {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video.mp4')
      await videoPublishPage.setAsNSFW()
      await videoPublishPage.validSecondStep(nsfwVideo)

      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video.mp4')
      await videoPublishPage.setAsNSFW({ summary: 'bibi is violent', violent: true })
      await videoPublishPage.validSecondStep(violentVideo)

      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video2.mp4')
      await videoPublishPage.validSecondStep(normalVideo)
    })

    it('Should logout', async function () {
      await loginPage.logout()
    })
  })

  describe('NSFW with an anonymous users using instance default', function () {
    it('Should correctly handle do not list', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('do_not_list')

      await loginPage.logout()

      await checkCommonVideoListPages('do_not_list', [ nsfwVideo, violentVideo ])
      await checkCommonVideoListPages('display', [ normalVideo ])

      await checkFilterText('do_not_list')
    })

    it('Should correctly handle blur', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('blur')

      await loginPage.logout()

      await checkCommonVideoListPages('blur', [ nsfwVideo, violentVideo ])
      await checkCommonVideoListPages('display', [ normalVideo ])

      await checkFilterText('blur')
    })

    it('Should not autoplay the video and display a warning on watch/embed page', async function () {
      await videoListPage.clickOnVideo(nsfwVideo)
      await videoWatchPage.waitWatchVideoName(nsfwVideo)

      videoUrl = await browser.getUrl()

      const check = async () => {
        expect(await playerPage.getPlayButton().isDisplayed()).toBeTruthy()

        expect(await playerPage.getNSFWContentText()).toContain('This video contains sensitive content')
        expect(await playerPage.getMoreNSFWInfoButton().isDisplayed()).toBeFalsy()
        expect(await playerPage.hasPoster()).toBeFalsy()
      }

      await check()
      await videoWatchPage.goOnAssociatedEmbed()
      await check()
    })

    it('Should correctly handle warn', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('warn')

      await loginPage.logout()

      await checkCommonVideoListPages('warn', [ nsfwVideo, violentVideo ])
      await checkCommonVideoListPages('display', [ normalVideo ])

      await checkFilterText('warn')
    })

    it('Should not autoplay the video and display a warning on watch/embed page', async function () {
      await videoListPage.clickOnVideo(violentVideo)
      await videoWatchPage.waitWatchVideoName(violentVideo)

      const check = async () => {
        expect(await playerPage.getPlayButton().isDisplayed()).toBeTruthy()

        expect(await playerPage.getNSFWContentText()).toContain('This video contains sensitive content')
        expect(await playerPage.hasPoster()).toBeTruthy()

        const moreButton = playerPage.getMoreNSFWInfoButton()
        expect(await moreButton.isDisplayed()).toBeTruthy()

        await moreButton.click()
        await playerPage.getNSFWDetailsContent().waitForDisplayed()

        const moreContent = await playerPage.getNSFWDetailsContent().getText()
        expect(moreContent).toContain('Potentially violent content')
        expect(moreContent).toContain('bibi is violent')
      }

      await check()
      await videoWatchPage.goOnAssociatedEmbed()
      await check()
    })

    it('Should correctly handle display', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('display')

      await loginPage.logout()

      await checkCommonVideoListPages('display', [ nsfwVideo, violentVideo, normalVideo ])

      await checkFilterText('display')
    })

    it('Should autoplay the video on watch page', async function () {
      await videoListPage.clickOnVideo(nsfwVideo)
      await videoWatchPage.waitWatchVideoName(nsfwVideo)

      expect(await playerPage.getPlayButton().isDisplayed()).toBeFalsy()
    })
  })

  describe('NSFW settings', function () {
    function runSuite (loggedIn: boolean) {
      it('Should correctly handle do not list', async () => {
        await updateUserNSFW('do_not_list', loggedIn)

        await checkCommonVideoListPages('do_not_list', [ nsfwVideo, violentVideo ])
        await checkCommonVideoListPages('display', [ normalVideo ])

        await checkFilterText('do_not_list')
      })

      it('Should use a confirm modal when viewing the video and watch the video', async function () {
        await go(videoUrl)

        const confirmTitle = videoWatchPage.getModalTitleEl()
        await confirmTitle.waitForDisplayed()
        expect(await confirmTitle.getText()).toContain('Sensitive video')

        await videoWatchPage.confirmModal()
        await videoWatchPage.waitWatchVideoName(nsfwVideo)
      })

      it('Should correctly handle blur', async () => {
        await updateUserNSFW('blur', loggedIn)

        await checkCommonVideoListPages('blur', [ nsfwVideo ], 'This video contains sensitive content')
        await checkCommonVideoListPages('blur', [ violentVideo ], 'This video contains sensitive content: violence')
        await checkCommonVideoListPages('display', [ normalVideo ])

        await checkFilterText('blur')
      })

      it('Should correctly handle warn', async () => {
        await updateUserNSFW('warn', loggedIn)

        await checkCommonVideoListPages('warn', [ nsfwVideo ], 'This video contains sensitive content')
        await checkCommonVideoListPages('warn', [ violentVideo ], 'This video contains sensitive content: violence')
        await checkCommonVideoListPages('display', [ normalVideo ])

        await checkFilterText('warn')
      })

      it('Should correctly handle display', async () => {
        await updateUserNSFW('display', loggedIn)

        await checkCommonVideoListPages('display', [ nsfwVideo, violentVideo, normalVideo ])

        await checkFilterText('display')
      })

      it('Should update the setting to blur violent video with display NSFW setting', async () => {
        await updateUserViolentNSFW('blur', loggedIn)

        await checkCommonVideoListPages('display', [ nsfwVideo, normalVideo ])
        await checkCommonVideoListPages('blur', [ violentVideo ])
      })

      it('Should update the setting to hide NSFW videos but warn violent videos', async () => {
        await updateUserNSFW('do_not_list', loggedIn)
        await updateUserViolentNSFW('warn', loggedIn)

        await checkCommonVideoListPages('display', [ normalVideo ])
        await checkCommonVideoListPages('warn', [ violentVideo ])
        await checkCommonVideoListPages('do_not_list', [ nsfwVideo ])
      })

      it('Should update the setting to blur NSFW videos and hide violent videos', async () => {
        await updateUserNSFW('blur', loggedIn)
        await updateUserViolentNSFW('do_not_list', loggedIn)

        await checkCommonVideoListPages('display', [ normalVideo ])
        await checkCommonVideoListPages('do_not_list', [ violentVideo ])
        await checkCommonVideoListPages('blur', [ nsfwVideo ])
      })
    }

    describe('NSFW with an anonymous user', function () {
      runSuite(false)
    })

    describe('NSFW with a logged in users', function () {
      before(async () => {
        await loginPage.login({ username: 'user_' + seed, password: 'superpassword' })
      })

      runSuite(true)

      after(async () => {
        await loginPage.logout()
      })
    })
  })
})
