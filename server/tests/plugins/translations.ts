/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  flushAndRunServer, killallServers, reRunServer,
  ServerInfo,
  waitUntilLog
} from '../../../shared/extra-utils/server/servers'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  deleteVideoComment,
  getPluginTestPath,
  getVideosList,
  installPlugin,
  removeVideo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  viewVideo,
  getVideosListPagination,
  getVideo,
  getVideoCommentThreads,
  getVideoThreadComments,
  getVideoWithToken,
  setDefaultVideoChannel,
  waitJobs,
  doubleFollow, getVideoLanguages, getVideoLicences, getVideoCategories, uninstallPlugin, getPluginTranslations
} from '../../../shared/extra-utils'
import { VideoCommentThreadTree } from '../../../shared/models/videos/video-comment.model'
import { VideoDetails } from '../../../shared/models/videos'
import { getYoutubeVideoUrl, importVideo } from '../../../shared/extra-utils/videos/video-imports'

const expect = chai.expect

describe('Test plugin translations', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath()
    })

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-two')
    })
  })

  it('Should not have translations for locale pt', async function () {
    const res = await getPluginTranslations({ url: server.url, locale: 'pt' })

    expect(res.body).to.deep.equal({})
  })

  it('Should have translations for locale fr', async function () {
    const res = await getPluginTranslations({ url: server.url, locale: 'fr-FR' })

    expect(res.body).to.deep.equal({
      'peertube-plugin-test': {
        'Hi': 'Coucou'
      },
      'peertube-plugin-test-two': {
        'Hello world': 'Bonjour le monde'
      }
    })
  })

  it('Should have translations of locale it', async function () {
    const res = await getPluginTranslations({ url: server.url, locale: 'it-IT' })

    expect(res.body).to.deep.equal({
      'peertube-plugin-test-two': {
        'Hello world': 'Ciao, mondo!'
      }
    })
  })

  it('Should remove the plugin and remove the locales', async function () {
    await uninstallPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-plugin-test-two' })

    {
      const res = await getPluginTranslations({ url: server.url, locale: 'fr-FR' })

      expect(res.body).to.deep.equal({
        'peertube-plugin-test': {
          'Hi': 'Coucou'
        }
      })
    }

    {
      const res = await getPluginTranslations({ url: server.url, locale: 'it-IT' })

      expect(res.body).to.deep.equal({})
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
