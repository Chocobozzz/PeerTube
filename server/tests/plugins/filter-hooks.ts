/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { ServerConfig } from '@shared/models'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  doubleFollow,
  getConfig,
  getPluginTestPath,
  getVideo,
  getVideoCommentThreads,
  getVideosList,
  getVideosListPagination,
  getVideoThreadComments,
  getVideoWithToken,
  installPlugin,
  registerUser,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateVideo,
  uploadVideo,
  waitJobs
} from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunMultipleServers, ServerInfo } from '../../../shared/extra-utils/server/servers'
import { getGoodVideoUrl, getMyVideoImports, importVideo } from '../../../shared/extra-utils/videos/video-imports'
import { VideoDetails, VideoImport, VideoImportState, VideoPrivacy } from '../../../shared/models/videos'
import { VideoCommentThreadTree } from '../../../shared/models/videos/video-comment.model'

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

  it('Should run filter:api.video.pre-import-url.accept.result', async function () {
    const baseAttributes = {
      name: 'normal title',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].videoChannel.id,
      targetUrl: getGoodVideoUrl() + 'bad'
    }
    await importVideo(servers[0].url, servers[0].accessToken, baseAttributes, 403)
  })

  it('Should run filter:api.video.pre-import-torrent.accept.result', async function () {
    const baseAttributes = {
      name: 'bad torrent',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].videoChannel.id,
      torrentfile: 'video-720p.torrent' as any
    }
    await importVideo(servers[0].url, servers[0].accessToken, baseAttributes, 403)
  })

  it('Should run filter:api.video.post-import-url.accept.result', async function () {
    this.timeout(60000)

    let videoImportId: number

    {
      const baseAttributes = {
        name: 'title with bad word',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].videoChannel.id,
        targetUrl: getGoodVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, baseAttributes)
      videoImportId = res.body.id
    }

    await waitJobs(servers)

    {
      const res = await getMyVideoImports(servers[0].url, servers[0].accessToken)
      const videoImports = res.body.data as VideoImport[]

      const videoImport = videoImports.find(i => i.id === videoImportId)

      expect(videoImport.state.id).to.equal(VideoImportState.REJECTED)
      expect(videoImport.state.label).to.equal('Rejected')
    }
  })

  it('Should run filter:api.video.post-import-torrent.accept.result', async function () {
    this.timeout(60000)

    let videoImportId: number

    {
      const baseAttributes = {
        name: 'title with bad word',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].videoChannel.id,
        torrentfile: 'video-720p.torrent' as any
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, baseAttributes)
      videoImportId = res.body.id
    }

    await waitJobs(servers)

    {
      const res = await getMyVideoImports(servers[0].url, servers[0].accessToken)
      const videoImports = res.body.data as VideoImport[]

      const videoImport = videoImports.find(i => i.id === videoImportId)

      expect(videoImport.state.id).to.equal(VideoImportState.REJECTED)
      expect(videoImport.state.label).to.equal('Rejected')
    }
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
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video please blacklist me' })
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on import', async function () {
      this.timeout(15000)

      const attributes = {
        name: 'video please blacklist me',
        targetUrl: getGoodVideoUrl(),
        channelId: servers[0].videoChannel.id
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on update', async function () {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
      const videoId = res.body.video.uuid
      await checkIsBlacklisted(res, false)

      await updateVideo(servers[0].url, servers[0].accessToken, videoId, { name: 'please blacklist me' })
      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on remote upload', async function () {
      this.timeout(45000)

      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'remote please blacklist me' })
      await waitJobs(servers)

      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on remote update', async function () {
      this.timeout(45000)

      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video' })
      await waitJobs(servers)

      const videoId = res.body.video.uuid
      await checkIsBlacklisted(res, false)

      await updateVideo(servers[1].url, servers[1].accessToken, videoId, { name: 'please blacklist me' })
      await waitJobs(servers)

      await checkIsBlacklisted(res, true)
    })
  })

  describe('Should run filter:api.user.signup.allowed.result', function () {

    it('Should run on config endpoint', async function () {
      const res = await getConfig(servers[0].url)
      expect((res.body as ServerConfig).signup.allowed).to.be.true
    })

    it('Should allow a signup', async function () {
      await registerUser(servers[0].url, 'john', 'password')
    })

    it('Should not allow a signup', async function () {
      const res = await registerUser(servers[0].url, 'jma', 'password', 403)

      expect(res.body.error).to.equal('No jma')
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
