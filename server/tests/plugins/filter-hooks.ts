/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getAccountVideos,
  getMyVideos,
  getVideo,
  getVideoChannelVideos,
  getVideoCommentThreads,
  getVideosList,
  getVideosListPagination,
  getVideoThreadComments,
  getVideoWithToken,
  makeRawRequest,
  PluginsCommand,
  registerUser,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateVideo,
  uploadVideo,
  uploadVideoAndGetId,
  waitJobs,
  waitUntilLog
} from '@shared/extra-utils'
import { getGoodVideoUrl, getMyVideoImports, importVideo } from '@shared/extra-utils/videos/video-imports'
import {
  VideoCommentThreadTree,
  VideoDetails,
  VideoImport,
  VideoImportState,
  VideoPlaylist,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@shared/models'

const expect = chai.expect

describe('Test plugin filter hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].pluginsCommand.install({ path: PluginsCommand.getPluginTestPath() })
    await servers[0].pluginsCommand.install({ path: PluginsCommand.getPluginTestPath('-filter-translations') })

    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'default video ' + i })
    }

    const res = await getVideosList(servers[0].url)
    videoUUID = res.body.data[0].uuid

    await servers[0].configCommand.updateCustomSubConfig({
      newConfig: {
        live: { enabled: true },
        signup: { enabled: true },
        import: {
          videos: {
            http: { enabled: true },
            torrent: { enabled: true }
          }
        }
      }
    })
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

  it('Should run filter:api.accounts.videos.list.params', async function () {
    const res = await getAccountVideos(servers[0].url, servers[0].accessToken, 'root', 0, 2)

    // 1 plugin do +1 to the count parameter
    expect(res.body.data).to.have.lengthOf(3)
  })

  it('Should run filter:api.accounts.videos.list.result', async function () {
    const res = await getAccountVideos(servers[0].url, servers[0].accessToken, 'root', 0, 2)

    // Plugin do +2 to the total result
    expect(res.body.total).to.equal(12)
  })

  it('Should run filter:api.video-channels.videos.list.params', async function () {
    const res = await getVideoChannelVideos(servers[0].url, servers[0].accessToken, 'root_channel', 0, 2)

    // 1 plugin do +3 to the count parameter
    expect(res.body.data).to.have.lengthOf(5)
  })

  it('Should run filter:api.video-channels.videos.list.result', async function () {
    const res = await getVideoChannelVideos(servers[0].url, servers[0].accessToken, 'root_channel', 0, 2)

    // Plugin do +3 to the total result
    expect(res.body.total).to.equal(13)
  })

  it('Should run filter:api.user.me.videos.list.params', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 2)

    // 1 plugin do +4 to the count parameter
    expect(res.body.data).to.have.lengthOf(6)
  })

  it('Should run filter:api.user.me.videos.list.result', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 2)

    // Plugin do +4 to the total result
    expect(res.body.total).to.equal(14)
  })

  it('Should run filter:api.video.get.result', async function () {
    const res = await getVideo(servers[0].url, videoUUID)

    expect(res.body.name).to.contain('<3')
  })

  it('Should run filter:api.video.upload.accept.result', async function () {
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video with bad word' }, HttpStatusCode.FORBIDDEN_403)
  })

  it('Should run filter:api.live-video.create.accept.result', async function () {
    const attributes = {
      name: 'video with bad word',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].videoChannel.id
    }

    await servers[0].liveCommand.create({ fields: attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should run filter:api.video.pre-import-url.accept.result', async function () {
    const baseAttributes = {
      name: 'normal title',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].videoChannel.id,
      targetUrl: getGoodVideoUrl() + 'bad'
    }
    await importVideo(servers[0].url, servers[0].accessToken, baseAttributes, HttpStatusCode.FORBIDDEN_403)
  })

  it('Should run filter:api.video.pre-import-torrent.accept.result', async function () {
    const baseAttributes = {
      name: 'bad torrent',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].videoChannel.id,
      torrentfile: 'video-720p.torrent' as any
    }
    await importVideo(servers[0].url, servers[0].accessToken, baseAttributes, HttpStatusCode.FORBIDDEN_403)
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
    await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'comment with bad word', HttpStatusCode.FORBIDDEN_403)
  })

  it('Should run filter:api.video-comment-reply.create.accept.result', async function () {
    const res = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'thread')
    threadId = res.body.comment.id

    await addVideoCommentReply(
      servers[0].url,
      servers[0].accessToken,
      videoUUID,
      threadId,
      'comment with bad word',
      HttpStatusCode.FORBIDDEN_403
    )
    await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID, threadId, 'comment with good word', HttpStatusCode.OK_200)
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
      this.timeout(120000)

      const res = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'remote please blacklist me' })
      await waitJobs(servers)

      await checkIsBlacklisted(res, true)
    })

    it('Should blacklist on remote update', async function () {
      this.timeout(120000)

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
      const body = await servers[0].configCommand.getConfig()
      expect(body.signup.allowed).to.be.true
    })

    it('Should allow a signup', async function () {
      await registerUser(servers[0].url, 'john', 'password')
    })

    it('Should not allow a signup', async function () {
      const res = await registerUser(servers[0].url, 'jma', 'password', HttpStatusCode.FORBIDDEN_403)

      expect(res.body.error).to.equal('No jma')
    })
  })

  describe('Download hooks', function () {
    const downloadVideos: VideoDetails[] = []

    before(async function () {
      this.timeout(120000)

      await servers[0].configCommand.updateCustomSubConfig({
        newConfig: {
          transcoding: {
            webtorrent: {
              enabled: true
            },
            hls: {
              enabled: true
            }
          }
        }
      })

      const uuids: string[] = []

      for (const name of [ 'bad torrent', 'bad file', 'bad playlist file' ]) {
        const uuid = (await uploadVideoAndGetId({ server: servers[0], videoName: name })).uuid
        uuids.push(uuid)
      }

      await waitJobs(servers)

      for (const uuid of uuids) {
        const res = await getVideo(servers[0].url, uuid)
        downloadVideos.push(res.body)
      }
    })

    it('Should run filter:api.download.torrent.allowed.result', async function () {
      const res = await makeRawRequest(downloadVideos[0].files[0].torrentDownloadUrl, 403)
      expect(res.body.error).to.equal('Liu Bei')

      await makeRawRequest(downloadVideos[1].files[0].torrentDownloadUrl, 200)
      await makeRawRequest(downloadVideos[2].files[0].torrentDownloadUrl, 200)
    })

    it('Should run filter:api.download.video.allowed.result', async function () {
      {
        const res = await makeRawRequest(downloadVideos[1].files[0].fileDownloadUrl, 403)
        expect(res.body.error).to.equal('Cao Cao')

        await makeRawRequest(downloadVideos[0].files[0].fileDownloadUrl, 200)
        await makeRawRequest(downloadVideos[2].files[0].fileDownloadUrl, 200)
      }

      {
        const res = await makeRawRequest(downloadVideos[2].streamingPlaylists[0].files[0].fileDownloadUrl, 403)
        expect(res.body.error).to.equal('Sun Jian')

        await makeRawRequest(downloadVideos[2].files[0].fileDownloadUrl, 200)

        await makeRawRequest(downloadVideos[0].streamingPlaylists[0].files[0].fileDownloadUrl, 200)
        await makeRawRequest(downloadVideos[1].streamingPlaylists[0].files[0].fileDownloadUrl, 200)
      }
    })
  })

  describe('Embed filters', function () {
    const embedVideos: VideoDetails[] = []
    const embedPlaylists: VideoPlaylist[] = []

    before(async function () {
      this.timeout(60000)

      await servers[0].configCommand.updateCustomSubConfig({
        newConfig: {
          transcoding: {
            enabled: false
          }
        }
      })

      for (const name of [ 'bad embed', 'good embed' ]) {
        {
          const uuid = (await uploadVideoAndGetId({ server: servers[0], videoName: name })).uuid
          const res = await getVideo(servers[0].url, uuid)
          embedVideos.push(res.body)
        }

        {
          const attributes = { displayName: name, videoChannelId: servers[0].videoChannel.id, privacy: VideoPlaylistPrivacy.PUBLIC }
          const { id } = await servers[0].playlistsCommand.create({ attributes })

          const playlist = await servers[0].playlistsCommand.get({ playlistId: id })
          embedPlaylists.push(playlist)
        }
      }
    })

    it('Should run filter:html.embed.video.allowed.result', async function () {
      const res = await makeRawRequest(servers[0].url + embedVideos[0].embedPath, 200)
      expect(res.text).to.equal('Lu Bu')
    })

    it('Should run filter:html.embed.video-playlist.allowed.result', async function () {
      const res = await makeRawRequest(servers[0].url + embedPlaylists[0].embedPath, 200)
      expect(res.text).to.equal('Diao Chan')
    })
  })

  describe('Search filters', function () {

    before(async function () {
      await servers[0].configCommand.updateCustomSubConfig({
        newConfig: {
          search: {
            searchIndex: {
              enabled: true,
              isDefaultSearch: false,
              disableLocalSearch: false
            }
          }
        }
      })
    })

    it('Should run filter:api.search.videos.local.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedVideoSearch({
        search: {
          search: 'Sun Quan'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.local.list.result', 1)
    })

    it('Should run filter:api.search.videos.index.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedVideoSearch({
        search: {
          search: 'Sun Quan',
          searchTarget: 'search-index'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.local.list.result', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.index.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.videos.index.list.result', 1)
    })

    it('Should run filter:api.search.video-channels.local.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedChannelSearch({
        search: {
          search: 'Sun Ce'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.local.list.result', 1)
    })

    it('Should run filter:api.search.video-channels.index.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedChannelSearch({
        search: {
          search: 'Sun Ce',
          searchTarget: 'search-index'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.local.list.result', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.index.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-channels.index.list.result', 1)
    })

    it('Should run filter:api.search.video-playlists.local.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedPlaylistSearch({
        search: {
          search: 'Sun Jian'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.local.list.result', 1)
    })

    it('Should run filter:api.search.video-playlists.index.list.{params,result}', async function () {
      await servers[0].searchCommand.advancedPlaylistSearch({
        search: {
          search: 'Sun Jian',
          searchTarget: 'search-index'
        }
      })

      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.local.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.local.list.result', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.index.list.params', 1)
      await waitUntilLog(servers[0], 'Run hook filter:api.search.video-playlists.index.list.result', 1)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
