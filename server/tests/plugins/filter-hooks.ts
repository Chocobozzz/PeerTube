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
  doubleFollow
} from '../../../shared/extra-utils'
import { VideoCommentThreadTree } from '../../../shared/models/videos/video-comment.model'
import { VideoDetails } from '../../../shared/models/videos'
import { getYoutubeVideoUrl, importVideo } from '../../../shared/extra-utils/videos/video-imports'

const expect = chai.expect

describe('Test plugin filter hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath()
    })

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath('-two')
    })

    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'default video ' + i })
    }

    const res = await getVideosList(servers[0].url)
    videoUUID = res.body.data[0].uuid
  })

  it('Should run filter:api.videos.list.params', async function () {
    const res = await getVideosListPagination(servers[0].url, 0, 2)

    // 2 plugins do +1 to the count parameter
    expect(res.body.data).to.have.lengthOf(4)
  })

  it('Should run filter:api.videos.list.result', async function () {
    const res = await getVideosListPagination(servers[0].url, 0, 0)

    // Plugin do +1 to the total result
    expect(res.body.total).to.equal(11)
  })

  it('Should run filter:api.video.get.result', async function () {
    const res = await getVideo(servers[0].url, videoUUID)

    expect(res.body.name).to.contain('<3')
  })

  it('Should run filter:api.video.upload.accept.result', async function () {
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video with bad word' }, 403)
  })

  it('Should run filter:api.video-thread.create.accept.result', async function () {
    await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'comment with bad word', 403)
  })

  it('Should run filter:api.video-comment-reply.create.accept.result', async function () {
    const res = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'thread')
    threadId = res.body.comment.id

    await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID, threadId, 'comment with bad word', 403)
    await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID, threadId, 'comment with good word', 200)
  })

  it('Should run filter:api.video-threads.list.params', async function () {
    const res = await getVideoCommentThreads(servers[0].url, videoUUID, 0, 0)

    // our plugin do +1 to the count parameter
    expect(res.body.data).to.have.lengthOf(1)
  })

  it('Should run filter:api.video-threads.list.result', async function () {
    const res = await getVideoCommentThreads(servers[0].url, videoUUID, 0, 0)

    // Plugin do +1 to the total result
    expect(res.body.total).to.equal(2)
  })

  it('Should run filter:api.video-thread-comments.list.params')

  it('Should run filter:api.video-thread-comments.list.result', async function () {
    const res = await getVideoThreadComments(servers[0].url, videoUUID, threadId)

    const thread = res.body as VideoCommentThreadTree
    expect(thread.comment.text.endsWith(' <3')).to.be.true
  })

  describe('Should run filter:video.auto-blacklist.result', function () {

    async function checkIsBlacklisted (oldRes: any, value: boolean) {
      const videoId = oldRes.body.video.uuid

      const res = await getVideoWithToken(servers[0].url, servers[0].accessToken, videoId)
      const video: VideoDetails = res.body
      expect(video.blacklisted).to.equal(value)
    }

    it('Should blacklist on upload', async function () {
      const res = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, { name: 'video please blacklist me' })
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on import', async function () {
      const attributes = {
        name: 'video please blacklist me',
        targetUrl: getYoutubeVideoUrl(),
        channelId: servers[0].videoChannel.id
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on update', async function () {
      const res = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, { name: 'video' })
      const videoId = res.body.video.uuid
      await checkIsBlacklisted(res, false)

      await updateVideo(servers[ 0 ].url, servers[ 0 ].accessToken, videoId, { name: 'please blacklist me' })
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on remote upload', async function () {
      this.timeout(45000)

      const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'remote please blacklist me' })
      await waitJobs(servers)

      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on remote update', async function () {
      this.timeout(45000)

      const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, { name: 'video' })
      await waitJobs(servers)

      const videoId = res.body.video.uuid
      await checkIsBlacklisted(res, false)

      await updateVideo(servers[1].url, servers[1].accessToken, videoId, { name: 'please blacklist me' })
      await waitJobs(servers)

      await checkIsBlacklisted(res, true)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
