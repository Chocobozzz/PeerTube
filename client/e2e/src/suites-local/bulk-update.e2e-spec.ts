import { BulkUpdatePage } from '../po/bulk-update.po'
import { LoginPage } from '../po/login.po'
import { MyVideosPage } from '../po/my-videos.po'
import { VideoPublishPage } from '../po/video-publish.po'
import { VideoUpdatePage } from '../po/video-update.po'
import { prepareWebBrowser, waitServerUp } from '../utils'

describe('Bulk update videos', () => {
  let loginPage: LoginPage
  let videoPublishPage: VideoPublishPage
  let bulkUpdatePage: BulkUpdatePage
  let myVideosPage: MyVideosPage
  let videoUpdatePage: VideoUpdatePage

  const seed = Math.random().toString().slice(2, 8)

  before(async () => {
    await waitServerUp()

    loginPage = new LoginPage()
    videoPublishPage = new VideoPublishPage()
    bulkUpdatePage = new BulkUpdatePage()
    myVideosPage = new MyVideosPage()
    videoUpdatePage = new VideoUpdatePage()

    await prepareWebBrowser()
    await loginPage.loginAsRootUser()

    // Upload two test videos so we have something to bulk update
    await videoPublishPage.navigateTo()
    await videoPublishPage.uploadVideo('video.mp4')
    await videoPublishPage.validSecondStep(`bulk-test-1-${seed}`)

    await videoPublishPage.navigateTo()
    await videoPublishPage.uploadVideo('video2.mp4')
    await videoPublishPage.validSecondStep(`bulk-test-2-${seed}`)
  })

  it('Should select videos and open the bulk update modal', async function () {
    await myVideosPage.navigateToMyVideos()

    await myVideosPage.selectVideoRow(`bulk-test-1-${seed}`)
    await myVideosPage.selectVideoRow(`bulk-test-2-${seed}`)

    await bulkUpdatePage.openBulkUpdate()
    await bulkUpdatePage.waitForConfigureStep()
  })

  it('Should add fields and show them in the confirm step', async function () {
    // Add "support" field (textarea) and set a value
    await bulkUpdatePage.addField('support')
    await bulkUpdatePage.setSupport('Updated support text')

    // Add "downloadEnabled" field (checkbox) and disable it
    await bulkUpdatePage.addField('downloadEnabled')
    await bulkUpdatePage.setDownloadEnabled(false)

    // Advance to the confirm step
    await bulkUpdatePage.clickNext()
    await bulkUpdatePage.waitForConfirmStep()

    const summary = await bulkUpdatePage.getConfirmSummaryText()
    expect(summary).toContain('Updated support text')
    expect(summary).toContain('No')
  })

  it('Should go back, modify values, and re-confirm', async function () {
    await bulkUpdatePage.clickBack()
    await bulkUpdatePage.waitForConfigureStep()

    // Re-enable downloads
    await bulkUpdatePage.setDownloadEnabled(true)

    await bulkUpdatePage.clickNext()
    await bulkUpdatePage.waitForConfirmStep()

    const summary = await bulkUpdatePage.getConfirmSummaryText()
    expect(summary).toContain('Updated support text')
    expect(summary).toContain('Yes')
  })

  it('Should execute the bulk update and persist changes', async function () {
    await bulkUpdatePage.clickUpdate()

    await $('.modal-header').waitForDisplayed({ reverse: true })

    // Navigate to the manage page for the first video to verify support was updated
    await myVideosPage.clickOnManage(`bulk-test-1-${seed}`)

    await $('my-video-manage-container').waitForDisplayed()

    const value = await videoUpdatePage.getSupportValue()
    expect(value).toContain('Updated support text')
  })
})
