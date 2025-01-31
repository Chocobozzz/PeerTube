/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { pick } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  HttpStatusCodeType,
  UserRole,
  Video,
  VideoDetails,
  VideoInclude,
  VideoIncludeType,
  VideoPrivacy,
  VideoPrivacyType,
  VideosCommonQuery
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test videos filter', function () {
  let servers: PeerTubeServer[]
  let paths: string[]
  let remotePaths: string[]

  const subscriptionVideosPath = '/api/v1/users/me/subscriptions/videos'

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    await servers[1].config.enableMinimumTranscoding()

    for (const server of servers) {
      const moderator = { username: 'moderator', password: 'my super password' }
      await server.users.create({ username: moderator.username, password: moderator.password, role: UserRole.MODERATOR })
      server['moderatorAccessToken'] = await server.login.getAccessToken(moderator)

      await server.videos.upload({ attributes: { name: 'public ' + server.serverNumber } })

      {
        const attributes = { name: 'unlisted ' + server.serverNumber, privacy: VideoPrivacy.UNLISTED }
        await server.videos.upload({ attributes })
      }

      {
        const attributes = { name: 'private ' + server.serverNumber, privacy: VideoPrivacy.PRIVATE }
        await server.videos.upload({ attributes })
      }

      // Subscribing to itself
      await server.subscriptions.add({ targetUri: 'root_channel@' + server.host })
    }

    await doubleFollow(servers[0], servers[1])

    paths = [
      `/api/v1/video-channels/root_channel/videos`,
      `/api/v1/accounts/root/videos`,
      '/api/v1/videos',
      '/api/v1/search/videos',
      subscriptionVideosPath
    ]

    remotePaths = [
      `/api/v1/video-channels/root_channel@${servers[1].host}/videos`,
      `/api/v1/accounts/root@${servers[1].host}/videos`,
      '/api/v1/videos',
      '/api/v1/search/videos'
    ]
  })

  describe('Check videos filters', function () {

    async function listVideos (options: {
      server: PeerTubeServer
      path: string

      token?: string
      expectedStatus?: HttpStatusCodeType
      excludeAlreadyWatched?: boolean
    } & VideosCommonQuery) {
      const res = await makeGetRequest({
        url: options.server.url,
        path: options.path,
        token: options.token ?? options.server.accessToken,
        query: {
          ...pick(options, [
            'isLocal',
            'include',
            'hasWebVideoFiles',
            'hasHLSFiles',
            'tagsAllOf',
            'categoryOneOf',
            'languageOneOf',
            'privacyOneOf',
            'excludeAlreadyWatched',
            'host',
            'search'
          ]),

          sort: 'createdAt'
        },
        expectedStatus: options.expectedStatus ?? HttpStatusCode.OK_200
      })

      return res.body.data as Video[]
    }

    async function getVideosNames (
      options: {
        server: PeerTubeServer
        isLocal?: boolean
        include?: VideoIncludeType
        privacyOneOf?: VideoPrivacyType[]
        token?: string
        expectedStatus?: HttpStatusCodeType
        skipSubscription?: boolean
        excludeAlreadyWatched?: boolean
      }
    ) {
      const { skipSubscription = false } = options
      const videosResults: string[][] = []

      for (const path of paths) {
        if (skipSubscription && path === subscriptionVideosPath) continue

        const videos = await listVideos({ ...options, path })

        videosResults.push(videos.map(v => v.name))
      }

      return videosResults
    }

    it('Should display local videos', async function () {
      for (const server of servers) {
        const namesResults = await getVideosNames({ server, isLocal: true })

        for (const names of namesResults) {
          expect(names).to.have.lengthOf(1)
          expect(names[0]).to.equal('public ' + server.serverNumber)
        }
      }
    })

    it('Should display local videos with hidden privacy by the admin or the moderator', async function () {
      for (const server of servers) {
        for (const token of [ server.accessToken, server['moderatorAccessToken'] ]) {

          const namesResults = await getVideosNames(
            {
              server,
              token,
              isLocal: true,
              privacyOneOf: [ VideoPrivacy.UNLISTED, VideoPrivacy.PUBLIC, VideoPrivacy.PRIVATE ],
              skipSubscription: true
            }
          )

          for (const names of namesResults) {
            expect(names).to.have.lengthOf(3)

            expect(names[0]).to.equal('public ' + server.serverNumber)
            expect(names[1]).to.equal('unlisted ' + server.serverNumber)
            expect(names[2]).to.equal('private ' + server.serverNumber)
          }
        }
      }
    })

    it('Should display all videos by the admin or the moderator', async function () {
      for (const server of servers) {
        for (const token of [ server.accessToken, server['moderatorAccessToken'] ]) {

          const [ channelVideos, accountVideos, videos, searchVideos ] = await getVideosNames({
            server,
            token,
            privacyOneOf: [ VideoPrivacy.UNLISTED, VideoPrivacy.PUBLIC, VideoPrivacy.PRIVATE ]
          })

          expect(channelVideos).to.have.lengthOf(3)
          expect(accountVideos).to.have.lengthOf(3)

          expect(videos).to.have.lengthOf(5)
          expect(searchVideos).to.have.lengthOf(5)
        }
      }
    })

    it('Should display only remote videos', async function () {
      this.timeout(120000)

      await servers[1].videos.upload({ attributes: { name: 'remote video' } })

      await waitJobs(servers)

      const finder = (videos: Video[]) => videos.find(v => v.name === 'remote video')

      for (const path of remotePaths) {
        {
          const videos = await listVideos({ server: servers[0], path })
          const video = finder(videos)
          expect(video).to.exist
        }

        {
          const videos = await listVideos({ server: servers[0], path, isLocal: false })
          const video = finder(videos)
          expect(video).to.exist
        }

        {
          const videos = await listVideos({ server: servers[0], path, isLocal: true })
          const video = finder(videos)
          expect(video).to.not.exist
        }
      }
    })

    it('Should include not published videos', async function () {
      await servers[0].config.enableLive({ allowReplay: false, transcoding: false })
      await servers[0].live.create({ fields: { name: 'live video', channelId: servers[0].store.channel.id, privacy: VideoPrivacy.PUBLIC } })

      const finder = (videos: Video[]) => videos.find(v => v.name === 'live video')

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path })
          const video = finder(videos)
          expect(video).to.not.exist
          expect(videos[0].state).to.not.exist
          expect(videos[0].waitTranscoding).to.not.exist
        }

        {
          const videos = await listVideos({ server: servers[0], path, include: VideoInclude.NOT_PUBLISHED_STATE })
          const video = finder(videos)
          expect(video).to.exist
          expect(video.state).to.exist
        }
      }
    })

    it('Should include blacklisted videos', async function () {
      const { id } = await servers[0].videos.upload({ attributes: { name: 'blacklisted' } })

      await servers[0].blacklist.add({ videoId: id })

      const finder = (videos: Video[]) => videos.find(v => v.name === 'blacklisted')

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path })
          const video = finder(videos)
          expect(video).to.not.exist
          expect(videos[0].blacklisted).to.not.exist
        }

        {
          const videos = await listVideos({ server: servers[0], path, include: VideoInclude.BLACKLISTED })
          const video = finder(videos)
          expect(video).to.exist
          expect(video.blacklisted).to.be.true
        }
      }
    })

    it('Should include videos from muted account', async function () {
      const finder = (videos: Video[]) => videos.find(v => v.name === 'remote video')

      await servers[0].blocklist.addToServerBlocklist({ account: 'root@' + servers[1].host })

      for (const path of remotePaths) {
        {
          const videos = await listVideos({ server: servers[0], path })
          const video = finder(videos)
          expect(video).to.not.exist

          // Some paths won't have videos
          if (videos[0]) {
            expect(videos[0].blockedOwner).to.not.exist
            expect(videos[0].blockedServer).to.not.exist
          }
        }

        {
          const videos = await listVideos({ server: servers[0], path, include: VideoInclude.BLOCKED_OWNER })

          const video = finder(videos)
          expect(video).to.exist
          expect(video.blockedServer).to.be.false
          expect(video.blockedOwner).to.be.true
        }
      }

      await servers[0].blocklist.removeFromServerBlocklist({ account: 'root@' + servers[1].host })
    })

    it('Should include videos from muted server', async function () {
      const finder = (videos: Video[]) => videos.find(v => v.name === 'remote video')

      await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })

      for (const path of remotePaths) {
        {
          const videos = await listVideos({ server: servers[0], path })
          const video = finder(videos)
          expect(video).to.not.exist

          // Some paths won't have videos
          if (videos[0]) {
            expect(videos[0].blockedOwner).to.not.exist
            expect(videos[0].blockedServer).to.not.exist
          }
        }

        {
          const videos = await listVideos({ server: servers[0], path, include: VideoInclude.BLOCKED_OWNER })
          const video = finder(videos)
          expect(video).to.exist
          expect(video.blockedServer).to.be.true
          expect(video.blockedOwner).to.be.false
        }
      }

      await servers[0].blocklist.removeFromServerBlocklist({ server: servers[1].host })
    })

    it('Should include video files', async function () {
      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path })

          for (const video of videos) {
            const videoWithFiles = video as VideoDetails

            expect(videoWithFiles.files).to.not.exist
            expect(videoWithFiles.streamingPlaylists).to.not.exist
          }
        }

        {
          const videos = await listVideos({ server: servers[0], path, include: VideoInclude.FILES })

          for (const video of videos) {
            const videoWithFiles = video as VideoDetails

            expect(videoWithFiles.files).to.exist
            expect(videoWithFiles.files).to.have.length.at.least(1)
          }
        }
      }
    })

    it('Should filter by tags and category', async function () {
      await servers[0].videos.upload({ attributes: { name: 'tag filter', tags: [ 'tag1', 'tag2' ] } })
      await servers[0].videos.upload({ attributes: { name: 'tag filter with category', tags: [ 'tag3' ], category: 4 } })

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path, tagsAllOf: [ 'tag1', 'tag2' ] })
          expect(videos).to.have.lengthOf(1)
          expect(videos[0].name).to.equal('tag filter')
        }

        {
          const videos = await listVideos({ server: servers[0], path, tagsAllOf: [ 'tag1', 'tag3' ] })
          expect(videos).to.have.lengthOf(0)
        }

        {
          const { data, total } = await servers[0].videos.list({ tagsAllOf: [ 'tag3' ], categoryOneOf: [ 4 ] })
          expect(total).to.equal(1)
          expect(data[0].name).to.equal('tag filter with category')
        }

        {
          const { total } = await servers[0].videos.list({ tagsAllOf: [ 'tag4' ], categoryOneOf: [ 4 ] })
          expect(total).to.equal(0)
        }
      }
    })

    it('Should filter by language', async function () {
      await servers[0].videos.upload({ attributes: { name: 'english', language: 'en' } })
      await servers[0].videos.upload({ attributes: { name: 'french', language: 'fr' } })

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path, languageOneOf: [ 'fr', 'en' ] })
          expect(videos).to.have.lengthOf(2)
          expect(videos.map(v => v.name)).to.have.members([ 'english', 'french' ])
        }

        {
          const videos = await listVideos({ server: servers[0], path, languageOneOf: [ 'ca', 'es' ] })
          expect(videos).to.have.lengthOf(0)
        }
      }
    })

    it('Should filter by host', async function () {
      await servers[0].videos.upload({ attributes: { name: 'filter host 1' } })
      await servers[1].videos.upload({ attributes: { name: 'filter host 2' } })

      await waitJobs(servers)

      const getVideos = (videos: Video[]) => videos.filter(v => v.name.includes('filter host'))

      {
        const { data } = await servers[0].videos.list({ search: 'filter host' })
        expect(getVideos(data)).to.have.lengthOf(2)
      }

      {
        const { data } = await servers[0].videos.list({ search: 'filter host', host: servers[0].host })
        const videos = getVideos(data)

        expect(videos).to.have.lengthOf(1)
        expect(videos.map(v => v.name)).to.have.members([ 'filter host 1' ])
      }

      {
        const { data } = await servers[0].videos.list({ host: 'example.com' })
        expect(data).to.have.lengthOf(0)
      }
    })

    it('Should filter by HLS or Web Video files', async function () {
      this.timeout(360000)

      const finderFactory = (name: string) => (videos: Video[]) => videos.some(v => v.name === name)

      await servers[0].config.enableTranscoding({ hls: false, webVideo: true })
      await servers[0].videos.upload({ attributes: { name: 'web video' } })
      const hasWebVideo = finderFactory('web video')

      await waitJobs(servers)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: false })
      await servers[0].videos.upload({ attributes: { name: 'hls video' } })
      const hasHLS = finderFactory('hls video')

      await waitJobs(servers)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: true })
      await servers[0].videos.upload({ attributes: { name: 'hls and web video' } })
      const hasBoth = finderFactory('hls and web video')

      await waitJobs(servers)

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path, hasWebVideoFiles: true })

          expect(hasWebVideo(videos)).to.be.true
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.true
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasWebVideoFiles: false })

          expect(hasWebVideo(videos)).to.be.false
          expect(hasHLS(videos)).to.be.true
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: true })

          expect(hasWebVideo(videos)).to.be.false
          expect(hasHLS(videos)).to.be.true
          expect(hasBoth(videos)).to.be.true
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: false })

          expect(hasWebVideo(videos)).to.be.true
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: false, hasWebVideoFiles: false })

          expect(hasWebVideo(videos)).to.be.false
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: true, hasWebVideoFiles: true })

          expect(hasWebVideo(videos)).to.be.false
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.true
        }
      }
    })

    it('Should filter already watched videos by the user', async function () {
      const { id } = await servers[0].videos.upload({ attributes: { name: 'video for history' } })

      for (const path of paths) {
        const videos = await listVideos({ server: servers[0], path, isLocal: true, excludeAlreadyWatched: true })
        const foundVideo = videos.find(video => video.id === id)

        expect(foundVideo).to.not.be.undefined
      }
      await servers[0].views.view({ id, currentTime: 1, token: servers[0].accessToken })

      for (const path of paths) {
        const videos = await listVideos({ server: servers[0], path, excludeAlreadyWatched: true })
        const foundVideo = videos.find(video => video.id === id)

        expect(foundVideo).to.be.undefined
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
