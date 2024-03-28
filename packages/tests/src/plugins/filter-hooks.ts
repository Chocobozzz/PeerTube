/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  HttpStatusCode,
  MyUser,
  PeerTubeProblemDocument,
  VideoDetails,
  VideoImportState,
  VideoPlaylist,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import {
  PeerTubeServer,
  PluginsCommand,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeActivityPubGetRequest,
  makeGetRequest,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectEndWith } from '@tests/shared/checks.js'
import { expect } from 'chai'
import { FIXTURE_URLS } from '../shared/fixture-urls.js'

describe('Test plugin filter hooks', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string
  let threadId: number
  let videoPlaylistUUID: string
  let importUserToken: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath() })
    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath('-filter-translations') })
    {
      ({ uuid: videoPlaylistUUID } = await servers[0].playlists.create({
        attributes: {
          displayName: 'my super playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          description: 'my super description',
          videoChannelId: servers[0].store.channel.id
        }
      }))
    }

    for (let i = 0; i < 10; i++) {
      const video = await servers[0].videos.upload({ attributes: { name: 'default video ' + i } })
      await servers[0].playlists.addElement({ playlistId: videoPlaylistUUID, attributes: { videoId: video.id } })
    }

    const { data } = await servers[0].videos.list()
    videoUUID = data[0].uuid

    await servers[0].config.updateExistingConfig({
      newConfig: {
        live: { enabled: true },
        signup: { enabled: true },
        videoFile: {
          update: {
            enabled: true
          }
        },
        import: {
          videos: {
            http: { enabled: true },
            torrent: { enabled: true }
          }
        }
      }
    })

    {
      const { userId, token } = await servers[0].users.generate('to_import')
      importUserToken = token
      await servers[0].users.update({ userId, videoQuota: -1, videoQuotaDaily: -1 })

      await servers[0].userImports.importArchive({ userId, token, fixture: 'export-with-files.zip' })
    }

    // Root subscribes to itself
    await servers[0].subscriptions.add({ targetUri: 'root_channel@' + servers[0].host })

    await waitJobs(servers)
  })

  describe('Videos', function () {

    it('Should run filter:api.videos.list.params', async function () {
      const { data } = await servers[0].videos.list({ start: 0, count: 2 })

      // 2 plugins do +1 to the count parameter
      expect(data).to.have.lengthOf(4)
    })

    it('Should run filter:api.videos.list.result', async function () {
      const { total } = await servers[0].videos.list({ start: 0, count: 0 })

      // Plugin do +1 to the total result
      expect(total).to.equal(12)
    })

    it('Should run filter:api.video-playlist.videos.list.params', async function () {
      const { data } = await servers[0].playlists.listVideos({
        count: 2,
        playlistId: videoPlaylistUUID
      })

      // 1 plugin do +1 to the count parameter
      expect(data).to.have.lengthOf(3)
    })

    it('Should run filter:api.video-playlist.videos.list.result', async function () {
      const { total } = await servers[0].playlists.listVideos({
        count: 0,
        playlistId: videoPlaylistUUID
      })

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

    it('Should run filter:api.user.me.subscription-videos.list.params', async function () {
      const { data } = await servers[0].videos.listMySubscriptionVideos({ start: 0, count: 2 })

      // 1 plugin do +1 to the count parameter
      expect(data).to.have.lengthOf(3)
    })

    it('Should run filter:api.user.me.subscription-videos.list.result', async function () {
      const { total } = await servers[0].videos.listMySubscriptionVideos({ start: 0, count: 2 })

      // Plugin do +4 to the total result
      expect(total).to.equal(14)
    })

    it('Should run filter:api.video.get.result', async function () {
      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.name).to.contain('<3')
    })
  })

  describe('Video/live/import accept', function () {

    it('Should run filter:api.video.upload.accept.result', async function () {
      const options = { attributes: { name: 'video with bad word' }, expectedStatus: HttpStatusCode.FORBIDDEN_403 }
      await servers[0].videos.upload({ mode: 'legacy', ...options })
      await servers[0].videos.upload({ mode: 'resumable', ...options })
    })

    it('Should run filter:api.video.update-file.accept.result', async function () {
      const res = await servers[0].videos.replaceSourceFile({
        videoId: videoUUID,
        fixture: 'video_short1.webm',
        completedExpectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      expect((res as any)?.error).to.equal('no webm')
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
      await servers[0].videoImports.importVideo({ attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should run filter:api.video.pre-import-torrent.accept.result', async function () {
      const attributes = {
        name: 'bad torrent',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id,
        torrentfile: 'video-720p.torrent' as any
      }
      await servers[0].videoImports.importVideo({ attributes, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
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
        const body = await servers[0].videoImports.importVideo({ attributes })
        videoImportId = body.id
      }

      await waitJobs(servers)

      {
        const body = await servers[0].videoImports.getMyVideoImports()
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
        const body = await servers[0].videoImports.importVideo({ attributes })
        videoImportId = body.id
      }

      await waitJobs(servers)

      {
        const { data: videoImports } = await servers[0].videoImports.getMyVideoImports()

        const videoImport = videoImports.find(i => i.id === videoImportId)

        expect(videoImport.state.id).to.equal(VideoImportState.REJECTED)
        expect(videoImport.state.label).to.equal('Rejected')
      }
    })

    it('Should run filter:api.video.user-import.video-attribute.result', async function () {
      const { data } = await servers[0].videos.listMyVideos({ token: importUserToken })
      expect(data).to.have.lengthOf(1)

      // We filter out video 1 in the plugin
      expect(data[0].name).to.not.equal('video 1')
    })
  })

  describe('Video comments accept', function () {

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

    it('Should run filter:activity-pub.remote-video-comment.create.accept.result on a thread creation', async function () {
      this.timeout(30000)

      await servers[1].comments.createThread({ videoId: videoUUID, text: 'comment with bad word' })

      await waitJobs(servers)

      {
        const thread = await servers[0].comments.listThreads({ videoId: videoUUID })
        expect(thread.data).to.have.lengthOf(1)
        expect(thread.data[0].text).to.not.include(' bad ')
      }

      {
        const thread = await servers[1].comments.listThreads({ videoId: videoUUID })
        expect(thread.data).to.have.lengthOf(2)
      }
    })

    it('Should run filter:activity-pub.remote-video-comment.create.accept.result on a reply creation', async function () {
      this.timeout(30000)

      const { data } = await servers[1].comments.listThreads({ videoId: videoUUID })
      const threadIdServer2 = data.find(t => t.text === 'thread').id

      await servers[1].comments.addReply({
        videoId: videoUUID,
        toCommentId: threadIdServer2,
        text: 'comment with bad word'
      })

      await waitJobs(servers)

      {
        const tree = await servers[0].comments.getThread({ videoId: videoUUID, threadId })
        expect(tree.children).to.have.lengthOf(1)
        expect(tree.children[0].comment.text).to.not.include(' bad ')
      }

      {
        const tree = await servers[1].comments.getThread({ videoId: videoUUID, threadId: threadIdServer2 })
        expect(tree.children).to.have.lengthOf(2)
      }
    })
  })

  describe('Video comments', function () {

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
  })

  describe('filter:video.auto-blacklist.result', function () {

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
      const body = await servers[0].videoImports.importVideo({ attributes })
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

  describe('Users', function () {
    it('Should run filter:api.user.me.get.result', async function () {
      const user = await servers[0].users.getMyInfo() as MyUser & { customParam: string }

      expect(user.customParam).to.equal('Customized')
    })
  })

  describe('Should run filter:api.user.signup.allowed.result', function () {

    before(async function () {
      await servers[0].config.updateExistingConfig({ newConfig: { signup: { requiresApproval: false } } })
    })

    it('Should run on config endpoint', async function () {
      const body = await servers[0].config.getConfig()
      expect(body.signup.allowed).to.be.true
    })

    it('Should allow a signup', async function () {
      await servers[0].registrations.register({ username: 'john1' })
    })

    it('Should not allow a signup', async function () {
      const res = await servers[0].registrations.register({
        username: 'jma 1',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      expect(res.body.error).to.equal('No jma 1')
    })
  })

  describe('Should run filter:api.user.request-signup.allowed.result', function () {

    before(async function () {
      await servers[0].config.updateExistingConfig({ newConfig: { signup: { requiresApproval: true } } })
    })

    it('Should run on config endpoint', async function () {
      const body = await servers[0].config.getConfig()
      expect(body.signup.allowed).to.be.true
    })

    it('Should allow a signup request', async function () {
      await servers[0].registrations.requestRegistration({ username: 'john2', registrationReason: 'tt' })
    })

    it('Should not allow a signup request', async function () {
      const body = await servers[0].registrations.requestRegistration({
        username: 'jma 2',
        registrationReason: 'tt',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      expect((body as unknown as PeerTubeProblemDocument).error).to.equal('No jma 2')
    })
  })

  describe('Download hooks', function () {
    const downloadVideos: VideoDetails[] = []
    let downloadVideo2Token: string

    before(async function () {
      this.timeout(120000)

      await servers[0].config.enableMinimumTranscoding({ hls: true, webVideo: true })

      const uuids: string[] = []

      for (const name of [ 'bad torrent', 'bad file', 'bad playlist file' ]) {
        const uuid = (await servers[0].videos.quickUpload({ name })).uuid
        uuids.push(uuid)
      }

      await waitJobs(servers)

      for (const uuid of uuids) {
        downloadVideos.push(await servers[0].videos.get({ id: uuid }))
      }

      downloadVideo2Token = await servers[0].videoToken.getVideoFileToken({ videoId: downloadVideos[2].uuid })
    })

    it('Should run filter:api.download.torrent.allowed.result', async function () {
      const res = await makeRawRequest({ url: downloadVideos[0].files[0].torrentDownloadUrl, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      expect(res.body.error).to.equal('Liu Bei')

      await makeRawRequest({ url: downloadVideos[1].files[0].torrentDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: downloadVideos[2].files[0].torrentDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should run filter:api.download.video.allowed.result', async function () {
      {
        const refused = downloadVideos[1].files[0].fileDownloadUrl
        const allowed = [
          downloadVideos[0].files[0].fileDownloadUrl,
          downloadVideos[2].files[0].fileDownloadUrl
        ]

        const res = await makeRawRequest({ url: refused, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        expect(res.body.error).to.equal('Cao Cao')

        for (const url of allowed) {
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
        }
      }

      {
        const refused = downloadVideos[2].streamingPlaylists[0].files[0].fileDownloadUrl

        const allowed = [
          downloadVideos[2].files[0].fileDownloadUrl,
          downloadVideos[0].streamingPlaylists[0].files[0].fileDownloadUrl,
          downloadVideos[1].streamingPlaylists[0].files[0].fileDownloadUrl
        ]

        // Only streaming playlist is refuse
        const res = await makeRawRequest({ url: refused, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
        expect(res.body.error).to.equal('Sun Jian')

        // But not we there is a user in res
        await makeRawRequest({ url: refused, token: servers[0].accessToken, expectedStatus: HttpStatusCode.OK_200 })
        await makeRawRequest({ url: refused, query: { videoFileToken: downloadVideo2Token }, expectedStatus: HttpStatusCode.OK_200 })

        // Other files work
        for (const url of allowed) {
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    })
  })

  describe('Embed filters', function () {
    const embedVideos: VideoDetails[] = []
    const embedPlaylists: VideoPlaylist[] = []

    before(async function () {
      this.timeout(60000)

      await servers[0].config.disableTranscoding()

      for (const name of [ 'bad embed', 'good embed' ]) {
        {
          const uuid = (await servers[0].videos.quickUpload({ name })).uuid
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
      const res = await makeGetRequest({ url: servers[0].url, path: embedVideos[0].embedPath, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.equal('Lu Bu')
    })

    it('Should run filter:html.embed.video-playlist.allowed.result', async function () {
      const res = await makeGetRequest({ url: servers[0].url, path: embedPlaylists[0].embedPath, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.equal('Diao Chan')
    })
  })

  describe('Client HTML filters', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(60000)

      const { uuid } = await servers[0].videos.quickUpload({ name: 'html video' })
      videoUUID = uuid
    })

    it('Should run filter:html.client.json-ld.result', async function () {
      const res = await makeGetRequest({ url: servers[0].url, path: '/w/' + videoUUID, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.contain('"recordedAt":"http://example.com/recordedAt"')
    })

    it('Should not run filter:html.client.json-ld.result with an account', async function () {
      const res = await makeGetRequest({ url: servers[0].url, path: '/a/root', expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).not.to.contain('"recordedAt":"http://example.com/recordedAt"')
    })
  })

  describe('Search filters', function () {

    before(async function () {
      await servers[0].config.updateExistingConfig({
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

  describe('Upload/import/live attributes filters', function () {

    before(async function () {
      await servers[0].config.enableLive({ transcoding: false, allowReplay: false })
      await servers[0].config.enableVideoImports()
      await servers[0].config.disableTranscoding()
    })

    it('Should run filter:api.video.upload.video-attribute.result', async function () {
      for (const mode of [ 'legacy' as 'legacy', 'resumable' as 'resumable' ]) {
        const { id } = await servers[0].videos.upload({ attributes: { name: 'video', description: 'upload' }, mode })

        const video = await servers[0].videos.get({ id })
        expect(video.description).to.equal('upload - filter:api.video.upload.video-attribute.result')
      }
    })

    it('Should run filter:api.video.import-url.video-attribute.result', async function () {
      const attributes = {
        name: 'video',
        description: 'import url',
        channelId: servers[0].store.channel.id,
        targetUrl: FIXTURE_URLS.goodVideo,
        privacy: VideoPrivacy.PUBLIC
      }
      const { video: { id } } = await servers[0].videoImports.importVideo({ attributes })

      const video = await servers[0].videos.get({ id })
      expect(video.description).to.equal('import url - filter:api.video.import-url.video-attribute.result')
    })

    it('Should run filter:api.video.import-torrent.video-attribute.result', async function () {
      const attributes = {
        name: 'video',
        description: 'import torrent',
        channelId: servers[0].store.channel.id,
        magnetUri: FIXTURE_URLS.magnet,
        privacy: VideoPrivacy.PUBLIC
      }
      const { video: { id } } = await servers[0].videoImports.importVideo({ attributes })

      const video = await servers[0].videos.get({ id })
      expect(video.description).to.equal('import torrent - filter:api.video.import-torrent.video-attribute.result')
    })

    it('Should run filter:api.video.live.video-attribute.result', async function () {
      const fields = {
        name: 'live',
        description: 'live',
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }
      const { id } = await servers[0].live.create({ fields })

      const video = await servers[0].videos.get({ id })
      expect(video.description).to.equal('live - filter:api.video.live.video-attribute.result')
    })

    it('Should run filter:api.video.user-import.video-attribute.result', async function () {
      this.timeout(60000)

      const { data } = await servers[0].videos.listMyVideos({ token: importUserToken })

      for (const video of data) {
        expectEndWith(video.description, ' - filter:api.video.user-import.video-attribute.result')
      }
    })
  })

  describe('Stats filters', function () {

    it('Should run filter:api.server.stats.get.result', async function () {
      const data = await servers[0].stats.get()

      expect((data as any).customStats).to.equal(14)
    })

  })

  describe('Job queue filters', function () {
    let videoUUID: string

    before(async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding()
      const { uuid } = await servers[0].videos.quickUpload({ name: 'studio' })

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.duration).at.least(2)
      videoUUID = video.uuid

      await waitJobs(servers)

      await servers[0].config.enableStudio()
    })

    it('Should run filter:job-queue.process.params', async function () {
      this.timeout(120_000)

      await servers[0].videoStudio.createEditionTasks({
        videoId: videoUUID,
        tasks: [
          {
            name: 'add-intro',
            options: {
              file: 'video_very_short_240p.mp4'
            }
          }
        ]
      })

      await waitJobs(servers)

      await servers[0].servers.waitUntilLog('Run hook filter:job-queue.process.params', 1, false)

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.duration).at.most(2)
    })

    it('Should run filter:job-queue.process.result', async function () {
      await servers[0].servers.waitUntilLog('Run hook filter:job-queue.process.result', 1, false)
    })
  })

  describe('Transcoding filters', async function () {

    it('Should run filter:transcoding.auto.resolutions-to-transcode.result', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'transcode-filter' })

      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.files).to.have.lengthOf(2)
      expect(video.files.find(f => f.resolution.id === 100 as any)).to.exist
    })
  })

  describe('Video channel filters', async function () {

    it('Should run filter:api.video-channels.list.params', async function () {
      const { data } = await servers[0].channels.list({ start: 0, count: 0 })

      // plugin do +1 to the count parameter
      expect(data).to.have.lengthOf(1)
    })

    it('Should run filter:api.video-channels.list.result', async function () {
      const { total } = await servers[0].channels.list({ start: 0, count: 1 })

      // plugin do +1 to the total parameter
      expect(total).to.equal(6)
    })

    it('Should run filter:api.video-channel.get.result', async function () {
      const channel = await servers[0].channels.get({ channelName: 'root_channel' })
      expect(channel.displayName).to.equal('Main root channel <3')
    })
  })

  describe('Activity Pub', function () {

    it('Should run filter:activity-pub.activity.context.build.result', async function () {
      const { body } = await makeActivityPubGetRequest(servers[0].url, '/w/' + videoUUID)
      expect(body.type).to.equal('Video')

      expect(body['@context'].some(c => {
        return typeof c === 'object' && c.recordedAt === 'https://schema.org/recordedAt'
      })).to.be.true
    })

    it('Should run filter:activity-pub.video.json-ld.build.result', async function () {
      const { body } = await makeActivityPubGetRequest(servers[0].url, '/w/' + videoUUID)
      expect(body.name).to.equal('default video 0')
      expect(body.videoName).to.equal('default video 0')
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
