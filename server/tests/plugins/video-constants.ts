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
  doubleFollow, getVideoLanguages, getVideoLicences, getVideoCategories, uninstallPlugin
} from '../../../shared/extra-utils'
import { VideoCommentThreadTree } from '../../../shared/models/videos/video-comment.model'
import { VideoDetails } from '../../../shared/models/videos'
import { getYoutubeVideoUrl, importVideo } from '../../../shared/extra-utils/videos/video-imports'

const expect = chai.expect

describe('Test plugin altering video constants', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-three')
    })
  })

  it('Should have updated languages', async function () {
    const res = await getVideoLanguages(server.url)
    const languages = res.body

    expect(languages['en']).to.not.exist
    expect(languages['fr']).to.not.exist

    expect(languages['al_bhed']).to.equal('Al Bhed')
    expect(languages['al_bhed2']).to.equal('Al Bhed 2')
  })

  it('Should have updated categories', async function () {
    const res = await getVideoCategories(server.url)
    const categories = res.body

    expect(categories[1]).to.not.exist
    expect(categories[2]).to.not.exist

    expect(categories[42]).to.equal('Best category')
    expect(categories[43]).to.equal('High best category')
  })

  it('Should have updated licences', async function () {
    const res = await getVideoLicences(server.url)
    const licences = res.body

    expect(licences[1]).to.not.exist
    expect(licences[7]).to.not.exist

    expect(licences[42]).to.equal('Best licence')
    expect(licences[43]).to.equal('High best licence')
  })

  it('Should be able to upload a video with these values', async function () {
    const attrs = { name: 'video', category: 42, licence: 42, language: 'al_bhed2' }
    const resUpload = await uploadVideo(server.url, server.accessToken, attrs)

    const res = await getVideo(server.url, resUpload.body.video.uuid)

    const video: VideoDetails = res.body
    expect(video.language.label).to.equal('Al Bhed 2')
    expect(video.licence.label).to.equal('Best licence')
    expect(video.category.label).to.equal('Best category')
  })

  it('Should uninstall the plugin and reset languages, categories and licences', async function () {
    await uninstallPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-plugin-test-three' })

    {
      const res = await getVideoLanguages(server.url)
      const languages = res.body

      expect(languages[ 'en' ]).to.equal('English')
      expect(languages[ 'fr' ]).to.equal('French')

      expect(languages[ 'al_bhed' ]).to.not.exist
      expect(languages[ 'al_bhed2' ]).to.not.exist
    }

    {
      const res = await getVideoCategories(server.url)
      const categories = res.body

      expect(categories[ 1 ]).to.equal('Music')
      expect(categories[ 2 ]).to.equal('Films')

      expect(categories[ 42 ]).to.not.exist
      expect(categories[ 43 ]).to.not.exist
    }

    {
      const res = await getVideoLicences(server.url)
      const licences = res.body

      expect(licences[ 1 ]).to.equal('Attribution')
      expect(licences[ 7 ]).to.equal('Public Domain Dedication')

      expect(licences[ 42 ]).to.not.exist
      expect(licences[ 43 ]).to.not.exist
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
