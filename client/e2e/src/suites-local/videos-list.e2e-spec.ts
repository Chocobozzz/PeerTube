import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account'
import { VideoListPage } from '../po/video-list.po'
import { VideoSearchPage } from '../po/video-search.po'
import { VideoUploadPage } from '../po/video-upload.po'
import { NSFWPolicy } from '../types/common'
import { isMobileDevice, isSafari, waitServerUp } from '../utils'

describe('Videos list', () => {
  let videoListPage: VideoListPage
  let videoUploadPage: VideoUploadPage
  let adminConfigPage: AdminConfigPage
  let loginPage: LoginPage
  let myAccountPage: MyAccountPage
  let videoSearchPage: VideoSearchPage

  const seed = Math.random()
  const nsfwVideo = seed + ' - nsfw'
  const normalVideo = seed + ' - normal'

  async function checkNormalVideo () {
    expect(await videoListPage.videoExists(normalVideo)).toBeTruthy()
    expect(await videoListPage.videoIsBlurred(normalVideo)).toBeFalsy()
  }

  async function checkNSFWVideo (policy: NSFWPolicy, filterText?: string) {
    if (policy === 'do_not_list') {
      if (filterText) expect(filterText).toContain('hidden')

      expect(await videoListPage.videoExists(nsfwVideo)).toBeFalsy()
      return
    }

    if (policy === 'blur') {
      if (filterText) expect(filterText).toContain('blurred')

      expect(await videoListPage.videoExists(nsfwVideo)).toBeTruthy()
      expect(await videoListPage.videoIsBlurred(nsfwVideo)).toBeTruthy()
      return
    }

    // display
    if (filterText) expect(filterText).toContain('displayed')

    expect(await videoListPage.videoExists(nsfwVideo)).toBeTruthy()
    expect(await videoListPage.videoIsBlurred(nsfwVideo)).toBeFalsy()
  }

  async function checkCommonVideoListPages (policy: NSFWPolicy) {
    const promisesWithFilters = [
      videoListPage.goOnRootAccount,
      videoListPage.goOnLocal,
      videoListPage.goOnRecentlyAdded,
      videoListPage.goOnTrending,
      videoListPage.goOnRootChannel
    ]

    for (const p of promisesWithFilters) {
      await p.call(videoListPage)

      const filter = await videoListPage.getNSFWFilter()
      const filterText = await filter.getText()

      await checkNormalVideo()
      await checkNSFWVideo(policy, filterText)
    }

    const promisesWithoutFilters = [
      videoListPage.goOnRootAccountChannels,
      videoListPage.goOnHomepage
    ]
    for (const p of promisesWithoutFilters) {
      await p.call(videoListPage)

      await checkNormalVideo()
      await checkNSFWVideo(policy)
    }
  }

  async function checkSearchPage (policy: NSFWPolicy) {
    await videoSearchPage.search(normalVideo)
    await checkNormalVideo()

    await videoSearchPage.search(nsfwVideo)
    await checkNSFWVideo(policy)
  }

  async function updateAdminNSFW (nsfw: NSFWPolicy) {
    await adminConfigPage.navigateTo('instance-information')
    await adminConfigPage.updateNSFWSetting(nsfw)
    await adminConfigPage.save()
  }

  async function updateUserNSFW (nsfw: NSFWPolicy) {
    await myAccountPage.navigateToMySettings()
    await myAccountPage.updateNSFW(nsfw)
  }

  before(async () => {
    await waitServerUp()
  })

  beforeEach(async () => {
    videoListPage = new VideoListPage(isMobileDevice(), isSafari())
    adminConfigPage = new AdminConfigPage()
    loginPage = new LoginPage()
    videoUploadPage = new VideoUploadPage()
    myAccountPage = new MyAccountPage()
    videoSearchPage = new VideoSearchPage()

    await browser.maximizeWindow()
  })

  it('Should login and disable NSFW', async () => {
    await loginPage.loginAsRootUser()
    await updateUserNSFW('display')
  })

  it('Should set the homepage', async () => {
    await adminConfigPage.navigateTo('instance-homepage')
    await adminConfigPage.updateHomepage('<peertube-videos-list data-sort="-publishedAt"></peertube-videos-list>')
    await adminConfigPage.save()
  })

  it('Should upload 2 videos (NSFW and classic videos)', async () => {
    await videoUploadPage.navigateTo()
    await videoUploadPage.uploadVideo()
    await videoUploadPage.setAsNSFW()
    await videoUploadPage.validSecondUploadStep(nsfwVideo)

    await videoUploadPage.navigateTo()
    await videoUploadPage.uploadVideo()
    await videoUploadPage.validSecondUploadStep(normalVideo)
  })

  it('Should logout', async function () {
    await loginPage.logout()
  })

  describe('Anonymous users', function () {

    it('Should correctly handle do not list', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('do_not_list')

      await loginPage.logout()
      await checkCommonVideoListPages('do_not_list')
      await checkSearchPage('do_not_list')
    })

    it('Should correctly handle blur', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('blur')

      await loginPage.logout()
      await checkCommonVideoListPages('blur')
      await checkSearchPage('blur')
    })

    it('Should correctly handle display', async () => {
      await loginPage.loginAsRootUser()
      await updateAdminNSFW('display')

      await loginPage.logout()
      await checkCommonVideoListPages('display')
      await checkSearchPage('display')
    })
  })

  describe('Logged in users', function () {

    before(async () => {
      await loginPage.loginAsRootUser()
    })

    it('Should correctly handle do not list', async () => {
      await updateUserNSFW('do_not_list')
      await checkCommonVideoListPages('do_not_list')
      await checkSearchPage('do_not_list')
    })

    it('Should correctly handle blur', async () => {
      await updateUserNSFW('blur')
      await checkCommonVideoListPages('blur')
      await checkSearchPage('blur')
    })

    it('Should correctly handle display', async () => {
      await updateUserNSFW('display')
      await checkCommonVideoListPages('display')
      await checkSearchPage('display')
    })
  })
})
