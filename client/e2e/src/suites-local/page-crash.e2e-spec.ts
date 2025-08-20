import { AdminConfigPage } from '../po/admin-config.po'
import { LoginPage } from '../po/login.po'
import { MyAccountPage } from '../po/my-account.po'
import { SignupPage } from '../po/signup.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoWatchPage } from '../po/video-watch.po'
import { getScreenshotPath, go, isMobileDevice, isSafari, selectCustomSelect, waitServerUp } from '../utils'

// These tests help to notice crash with invalid translated strings
describe('Page crash', () => {
  let videoPublishPage: VideoPublishPage
  let loginPage: LoginPage
  let videoWatchPage: VideoWatchPage
  let adminConfigPage: AdminConfigPage
  let myAccountPage: MyAccountPage

  let lastLanguage = ''

  const languages = [
    'العربية',
    'Català',
    'Čeština',
    'Deutsch',
    'ελληνικά',
    'Esperanto',
    'Español',
    'Euskara',
    'فارسی',
    'Suomi',
    'Français',
    'Gàidhlig',
    'Galego',
    'Hrvatski',
    'Magyar',
    'Íslenska',
    'Italiano',
    '日本語',
    'Taqbaylit',
    'Norsk bokmål',
    'Nederlands',
    'Norsk nynorsk',
    'Occitan',
    'Polski',
    'Português (Brasil)',
    'Português (Portugal)',
    'Pусский',
    'Slovenčina',
    'Shqip',
    'Svenska',
    'ไทย',
    'Toki Pona',
    'Türkçe',
    'украї́нська мо́ва',
    'Tiếng Việt',
    '简体中文（中国）',
    '繁體中文（台灣）'
  ]

  async function testForAllLanguages (action: () => Promise<void>) {
    for (const language of languages) {
      lastLanguage = language

      await go('/')

      await $('.settings-button').waitForClickable()
      await $('.settings-button').click()

      await selectCustomSelect('language', language)

      await action()
    }
  }

  before(async () => {
    await waitServerUp()

    myAccountPage = new MyAccountPage()
    adminConfigPage = new AdminConfigPage()
    loginPage = new LoginPage(isMobileDevice())
    videoPublishPage = new VideoPublishPage()
    videoWatchPage = new VideoWatchPage(isMobileDevice(), isSafari())

    await browser.maximizeWindow()

    await loginPage.loginAsRootUser()
  })

  it('Should set a homepage', async function () {
    await testForAllLanguages(async () => {
      await adminConfigPage.updateHomepage('My custom homepage content')

      // All tests
      await go('/home')

      await $('*=My custom homepage content').waitForDisplayed()
    })
  })

  it('Should upload and watch a video', async function () {
    await testForAllLanguages(async () => {
      await videoPublishPage.navigateTo()
      await videoPublishPage.uploadVideo('video3.mp4')
      await videoPublishPage.validSecondStep('video')

      await videoPublishPage.clickOnWatch()
      await videoWatchPage.waitWatchVideoName('video')
    })
  })

  it('Should go on client pages and not crash', async function () {
    await testForAllLanguages(async () => {
      await go('/videos/overview')

      await $('h1*=Home').waitForDisplayed()
    })
  })

  after(async () => {
    await browser.saveScreenshot(getScreenshotPath(`after-page-crash-test-${lastLanguage}.png`))
  })
})
