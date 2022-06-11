/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  FIXTURE_URLS,
  makeRawRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/extra-utils'
import { HttpStatusCode, VideoDetails, VideoImportState, VideoPlaylist, VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'

const expect = chai.expect

describe('Test plugin filter hooks', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string
  let threadId: number

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath() })
    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-filter-translations') })

    for (let i = 0; i < 10; i++) {
      await servers[0].videos.upload({ attributes: { name: 'default video ' + i } })
    }

    const { data } = await servers[0].videos.list()
    videoUUID = data[0].uuid

    await servers[0].config.updateCustomSubConfig({
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
    const { data } = await servers[0].videos.list({ start: 0, count: 2 })

    // 2 plugins do +1 to the count parameter
    expect(data).to.have.lengthOf(4)
  })

  it('Should run filter:api.videos.list.result', async function () {
    const { total } = await servers[0].videos.list({ start: 0, count: 0 })

    // Plugin do +1 to the total result
    expect(total).to.equal(11)
  })

  it('Should run filter:api.accounts.videos.list.params', async function () {
    const { data } = await servers[0].videos.listByAccount({ handle: 'root', start: 0, count: 2 })

    // 1 plugin do +1 to the count parameter
    expect(data).to.have.lengthOf(3)
  })

  it('Should run filter:api.accounts.videos.list.result', async function () {
    const { total } = await servers[0].videos.listByAccount({ handle: 'root', start: 0, count: 2 })

    // Plugin do +2 to the total result
    expect(total).to.equal(12)
  })

  it('Should run filter:api.video-channels.videos.list.params', async function () {
    const { data } = await servers[0].videos.listByChannel({ handle: 'root_channel', start: 0, count: 2 })

    // 1 plugin do +3 to the count parameter
    expect(data).to.have.lengthOf(5)
  })

  it('Should run filter:api.video-channels.videos.list.result', async function () {
    const { total } = await servers[0].videos.listByChannel({ handle: 'root_channel', start: 0, count: 2 })

    // Plugin do +3 to the total result
    expect(total).to.equal(13)
  })

  it('Should run filter:api.user.me.videos.list.params', async function () {
    const { data } = await servers[0].videos.listMyVideos({ start: 0, count: 2 })

    // 1 plugin do +4 to the count parameter
    expect(data).to.have.lengthOf(6)
  })

  it('Should run filter:api.user.me.videos.list.result', async function () {
    const { total } = await servers[0].videos.listMyVideos({ start: 0, count: 2 })

    // Plugin do +4 to the total result
    expect(total).to.equal(14)
  })

  it('Should run filter:api.video.get.result', async function () {
    const video = await servers[0].videos.get({ id: videoUUID })
    expect(video.name).to.contain('<3')
  })

  it('Should run filter:api.video.upload.accept.result', async function () {
    await servers[0].videos.upload({ attributes: { name: 'video with bad word' }, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should run filter:api.live-video.create.accept.result', async function () {
    const attributes = {
      name: 'video with bad word',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].store.channel.id
    }

    await servers[0].live.create({ fields: attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should run filter:api.video.pre-import-url.accept.result', async function () {
    const attributes = {
      name: 'normal title',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].store.channel.id,
      targetUrl: FIXTURE_URLS.goodVideo + 'bad'
    }
    await servers[0].imports.importVideo({ attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should run filter:api.video.pre-import-torrent.accept.result', async function () {
    const attributes = {
      name: 'bad torrent',
      privacy: VideoPrivacy.PUBLIC,
      channelId: servers[0].store.channel.id,
      torrentfile: 'video-720p.torrent' as any
    }
    await servers[0].imports.importVideo({ attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should run filter:api.video.post-import-url.accept.result', async function () {
    this.timeout(60000)

    let videoImportId: number

    {
      const attributes = {
        name: 'title with bad word',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id,
        targetUrl: FIXTURE_URLS.goodVideo
      }
      const body = await servers[0].imports.importVideo({ attributes })
      videoImportId = body.id
    }

    await waitJobs(servers)

    {
      const body = await servers[0].imports.getMyVideoImports()
      const videoImports = body.data

      const videoImport = videoImports.find(i => i.id === videoImportId)

      expect(videoImport.state.id).to.equal(VideoImportState.REJECTED)
      expect(videoImport.state.label).to.equal('Rejected')
    }
  })

  it('Should run filter:api.video.post-import-torrent.accept.result', async function () {
    this.timeout(60000)

    let videoImportId: number

    {
      const attributes = {
        name: 'title with bad word',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id,
        torrentfile: 'video-720p.torrent' as any
      }
      const body = await servers[0].imports.importVideo({ attributes })
      videoImportId = body.id
    }

    await waitJobs(servers)

    {
      const { data: videoImports } = await servers[0].imports.getMyVideoImports()

      const videoImport = videoImports.find(i => i.id === videoImportId)

      expect(videoImport.state.id).to.equal(VideoImportState.REJECTED)
      expect(videoImport.state.label).to.equal('Rejected')
    }
  })

  it('Should run filter:api.video-thread.create.accept.result', async function () {
    await servers[0].comments.createThread({
      videoId: videoUUID,
      text: 'comment with bad word',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should run filter:api.video-comment-reply.create.accept.result', async function () {
    const created = await servers[0].comments.createThread({ videoId: videoUUID, text: 'thread' })
    threadId = created.id

    await servers[0].comments.addReply({
      videoId: videoUUID,
      toCommentId: threadId,
      text: 'comment with bad word',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
    await servers[0].comments.addReply({
      videoId: videoUUID,
      toCommentId: threadId,
      text: 'comment with good word',
      expectedStatus: HttpStatusCode.OK_200
    })
  })

  it('Should run filter:api.video-threads.list.params', async function () {
    const { data } = await servers[0].comments.listThreads({ videoId: videoUUID, start: 0, count: 0 })

    // our plugin do +1 to the count parameter
    expect(data).to.have.lengthOf(1)
  })

  it('Should run filter:api.video-threads.list.result', async function () {
    const { total } = await servers[0].comments.listThreads({ videoId: videoUUID, start: 0, count: 0 })

    // Plugin do +1 to the total result
    expect(total).to.equal(2)
  })

  it('Should run filter:api.video-thread-comments.list.params')

  it('Should run filter:api.video-thread-comments.list.result', async function () {
    const thread = await servers[0].comments.getThread({ videoId: videoUUID, threadId })

    expect(thread.comment.text.endsWith(' <3')).to.be.true
  })

  it('Should run filter:api.overviews.videos.list.{params,result}', async function () {
    await servers[0].overviews.getVideos({ page: 1 })

    // 3 because we get 3 samples per page
    await servers[0].servers.waitUntilLog('Run hook filter:api.overviews.videos.list.params', 3)
    await servers[0].servers.waitUntilLog('Run hook filter:api.overviews.videos.list.result', 3)
  })

  describe('Should run filter:video.auto-blacklist.result', function () {

    async function checkIsBlacklisted (id: number | string, value: boolean) {
      const video = await servers[0].videos.getWithToken({ id })
      expect(video.blacklisted).to.equal(value)
    }

    it('Should blacklist on upload', async function () {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video please blacklist me' } })
      await checkIsBlacklisted(uuid, true)
    })

    it('Should blacklist on import', async function () {
      this.timeout(15000)

      const attributes = {
        name: 'video please blacklist me',
        targetUrl: FIXTURE_URLS.goodVideo,
        channelId: servers[0].store.channel.id
      }
      const body = await servers[0].imports.importVideo({ attributes })
      await checkIsBlacklisted(body.video.uuid, true)
    })

    it('Should blacklist on update', async function () {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video' } })
      await checkIsBlacklisted(uuid, false)

      await servers[0].videos.update({ id: uuid, attributes: { name: 'please blacklist me' } })
      await checkIsBlacklisted(uuid, true)
    })

    it('Should blacklist on remote upload', async function () {
      this.timeout(120000)

      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'remote please blacklist me' } })
      await waitJobs(servers)

      await checkIsBlacklisted(uuid, true)
    })

    it('Should blacklist on remote update', async function () {
      this.timeout(120000)

      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video' } })
      await waitJobs(servers)

      await checkIsBlacklisted(uuid, false)

      await servers[1].videos.update({ id: uuid, attributes: { name: 'please blacklist me' } })
      await waitJobs(servers)

      await checkIsBlacklisted(uuid, true)
    })
  })

  describe('Should run filter:api.user.signup.allowed.result', function () {

    it('Should run on config endpoint', async function () {
      const body = await servers[0].config.getConfig()
      expect(body.signup.allowed).to.be.true
    })

    it('Should allow a signup', async function () {
      await servers[0].users.register({ username: 'john', password: 'password' })
    })

    it('Should not allow a signup', async function () {
      const res = await servers[0].users.register({
        username: 'jma',
        password: 'password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      expect(res.body.error).to.equal('No jma')
    })
  })

  describe('Download hooks', function () {
    const downloadVideos: VideoDetails[] = []

    before(async function () {
      this.timeout(120000)

      await servers[0].config.updateCustomSubConfig({
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
        const uuid = (await servers[0].videos.quickUpload({ name: name })).uuid
        uuids.push(uuid)
      }

      await waitJobs(servers)

      for (const uuid of uuids) {
        downloadVideos.push(await servers[0].videos.get({ id: uuid }))
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

      await servers[0].config.updateCustomSubConfig({
        newConfig: {
          transcoding: {
            enabled: false
          }
        }
      })

      for (const name of [ 'bad embed', 'good embed' ]) {
        {
          const uuid = (await servers[0].videos.quickUpload({ name: name })).uuid
          embedVideos.push(await servers[0].videos.get({ id: uuid }))
        }

        {
          const attributes = { displayName: name, videoChannelId: servers[0].store.channel.id, privacy: VideoPlaylistPrivacy.PUBLIC }
          const { id } = await servers[0].playlists.create({ attributes })

          const playlist = await servers[0].playlists.get({ playlistId: id })
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
      await servers[0].config.updateCustomSubConfig({
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
      await servers[0].search.advancedVideoSearch({
        search: {
          search: 'Sun Quan'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.local.list.result', 1)
    })

    it('Should run filter:api.search.videos.index.list.{params,result}', async function () {
      await servers[0].search.advancedVideoSearch({
        search: {
          search: 'Sun Quan',
          searchTarget: 'search-index'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.local.list.result', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.index.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.videos.index.list.result', 1)
    })

    it('Should run filter:api.search.video-channels.local.list.{params,result}', async function () {
      await servers[0].search.advancedChannelSearch({
        search: {
          search: 'Sun Ce'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.local.list.result', 1)
    })

    it('Should run filter:api.search.video-channels.index.list.{params,result}', async function () {
      await servers[0].search.advancedChannelSearch({
        search: {
          search: 'Sun Ce',
          searchTarget: 'search-index'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.local.list.result', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.index.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-channels.index.list.result', 1)
    })

    it('Should run filter:api.search.video-playlists.local.list.{params,result}', async function () {
      await servers[0].search.advancedPlaylistSearch({
        search: {
          search: 'Sun Jian'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.local.list.result', 1)
    })

    it('Should run filter:api.search.video-playlists.index.list.{params,result}', async function () {
      await servers[0].search.advancedPlaylistSearch({
        search: {
          search: 'Sun Jian',
          searchTarget: 'search-index'
        }
      })

      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.local.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.local.list.result', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.index.list.params', 1)
      await servers[0].servers.waitUntilLog('Run hook filter:api.search.video-playlists.index.list.result', 1)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
