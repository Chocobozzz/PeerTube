/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pick } from '@shared/core-utils'
import { HttpStatusCode, UserRole, Video, VideoDetails, VideoInclude, VideoPrivacy } from '@shared/models'
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
} from '@shared/server-commands'

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

  describe('Check deprecated videos filter', function () {

    async function getVideosNames (options: {
      server: PeerTubeServer
      token: string
      filter: string
      skipSubscription?: boolean
      expectedStatus?: HttpStatusCode
    }) {
      const { server, token, filter, skipSubscription = false, expectedStatus = HttpStatusCode.OK_200 } = options

      const videosResults: Video[][] = []

      for (const path of paths) {
        if (skipSubscription && path === subscriptionVideosPath) continue

        const res = await makeGetRequest({
          url: server.url,
          path,
          token,
          query: {
            sort: 'createdAt',
            filter
          },
          expectedStatus
        })

        videosResults.push(res.body.data.map(v => v.name))
      }

      return videosResults
    }

    it('Should display local videos', async function () {
      for (const server of servers) {
        const namesResults = await getVideosNames({ server, token: server.accessToken, filter: 'local' })
        for (const names of namesResults) {
          expect(names).to.have.lengthOf(1)
          expect(names[0]).to.equal('public ' + server.serverNumber)
        }
      }
    })

    it('Should display all local videos by the admin or the moderator', async function () {
      for (const server of servers) {
        for (const token of [ server.accessToken, server['moderatorAccessToken'] ]) {

          const namesResults = await getVideosNames({ server, token, filter: 'all-local', skipSubscription: true })
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

          const [ channelVideos, accountVideos, videos, searchVideos ] = await getVideosNames({ server, token, filter: 'all' })
          expect(channelVideos).to.have.lengthOf(3)
          expect(accountVideos).to.have.lengthOf(3)

          expect(videos).to.have.lengthOf(5)
          expect(searchVideos).to.have.lengthOf(5)
        }
      }
    })
  })

  describe('Check videos filters', function () {

    async function listVideos (options: {
      server: PeerTubeServer
      path: string
      isLocal?: boolean
      hasWebtorrentFiles?: boolean
      hasHLSFiles?: boolean
      include?: VideoInclude
      privacyOneOf?: VideoPrivacy[]
      category?: number
      tagsAllOf?: string[]
      token?: string
      expectedStatus?: HttpStatusCode
    }) {
      const res = await makeGetRequest({
        url: options.server.url,
        path: options.path,
        token: options.token ?? options.server.accessToken,
        query: {
          ...pick(options, [ 'isLocal', 'include', 'category', 'tagsAllOf', 'hasWebtorrentFiles', 'hasHLSFiles', 'privacyOneOf' ]),

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
        include?: VideoInclude
        privacyOneOf?: VideoPrivacy[]
        token?: string
        expectedStatus?: HttpStatusCode
        skipSubscription?: boolean
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

    it('Should filter by HLS or WebTorrent files', async function () {
      this.timeout(360000)

      const finderFactory = (name: string) => (videos: Video[]) => videos.some(v => v.name === name)

      await servers[0].config.enableTranscoding(true, false)
      await servers[0].videos.upload({ attributes: { name: 'webtorrent video' } })
      const hasWebtorrent = finderFactory('webtorrent video')

      await waitJobs(servers)

      await servers[0].config.enableTranscoding(false, true)
      await servers[0].videos.upload({ attributes: { name: 'hls video' } })
      const hasHLS = finderFactory('hls video')

      await waitJobs(servers)

      await servers[0].config.enableTranscoding(true, true)
      await servers[0].videos.upload({ attributes: { name: 'hls and webtorrent video' } })
      const hasBoth = finderFactory('hls and webtorrent video')

      await waitJobs(servers)

      for (const path of paths) {
        {
          const videos = await listVideos({ server: servers[0], path, hasWebtorrentFiles: true })

          expect(hasWebtorrent(videos)).to.be.true
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.true
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasWebtorrentFiles: false })

          expect(hasWebtorrent(videos)).to.be.false
          expect(hasHLS(videos)).to.be.true
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: true })

          expect(hasWebtorrent(videos)).to.be.false
          expect(hasHLS(videos)).to.be.true
          expect(hasBoth(videos)).to.be.true
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: false })

          expect(hasWebtorrent(videos)).to.be.true
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: false, hasWebtorrentFiles: false })

          expect(hasWebtorrent(videos)).to.be.false
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.false
        }

        {
          const videos = await listVideos({ server: servers[0], path, hasHLSFiles: true, hasWebtorrentFiles: true })

          expect(hasWebtorrent(videos)).to.be.false
          expect(hasHLS(videos)).to.be.false
          expect(hasBoth(videos)).to.be.true
        }
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
