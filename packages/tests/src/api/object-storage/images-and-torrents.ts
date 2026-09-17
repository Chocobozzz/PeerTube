/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { maxBy } from '@peertube/peertube-core-utils'
import {
  ActivityBitTorrentUrlObject,
  ActivityIconObject,
  ActivityMagnetUrlObject,
  FileStorage,
  HttpStatusCode,
  RunnerJobVODAudioMergeTranscodingPayload,
  VideoDetails,
  VideoObject,
  VideoPlaylistPrivacy
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  getRedirectionUrl,
  makeActivityPubGetRequest,
  makeRawRequest,
  ObjectStorageCommand,
  OptionalObjectStorageType,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import {
  downloadFile,
  expectAllReplaced,
  expectNotFound,
  expectSameImages,
  expectSimilarImage,
  expectStartWith
} from '@tests/shared/checks.js'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'
import { fetchTorrent, getTorrentInfoHash } from '@tests/shared/p2p.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { basename, join } from 'path'

describe('Object storage for images and torrents', function () {
  if (areMockObjectStorageTestsDisabled()) return

  // Server 1 stores avatars, thumbnails, storyboards, torrents and uploads in object storage
  // Server 2 enables object storage for videos, but not for these files
  // Server 3 enables these files in object storage, but object storage is disabled
  let servers: PeerTubeServer[]
  let server: PeerTubeServer

  let uuid: string
  let playlistUUID: string

  // Video of servers 2 and 3, by server index
  const fsVideoUUIDs: { [index: number]: string } = {}

  const objectStorage = new ObjectStorageCommand()
  const allOptionalTypes: OptionalObjectStorageType[] = [ 'avatars', 'thumbnails', 'storyboards', 'torrents', 'uploads' ]

  async function getFileUrls (server: PeerTubeServer, videoUUID: string) {
    const me = await server.users.getMyInfo()
    const channel = await server.channels.get({ channelName: server.store.channel.name })
    const video = await server.videos.get({ id: videoUUID })
    const { storyboards } = await server.storyboard.list({ id: videoUUID })
    const config = await server.config.getConfig()

    const { data: playlists } = await server.playlists.listByAccount({ handle: 'root', token: server.accessToken })
    const playlist = playlists.find(p => p.thumbnails.length !== 0)

    return {
      avatars: [ ...me.account.avatars.map(a => a.fileUrl), ...channel.banners.map(b => b.fileUrl) ],
      thumbnails: [ ...video.thumbnails.map(t => t.fileUrl), ...playlist.thumbnails.map(t => t.fileUrl) ],
      storyboards: storyboards.map(s => s.fileUrl),
      torrents: video.files.map(f => f.torrentUrl),
      uploads: config.instance.logo.filter(l => !l.isFallback).map(l => l.fileUrl)
    }
  }

  function getBucketBaseUrl (type: OptionalObjectStorageType) {
    switch (type) {
      case 'avatars':
        return objectStorage.getMockActorImagesBaseUrl()
      case 'thumbnails':
        return objectStorage.getMockThumbnailsBaseUrl()
      case 'storyboards':
        return objectStorage.getMockStoryboardsBaseUrl()
      case 'torrents':
        return objectStorage.getMockTorrentsBaseUrl()
      case 'uploads':
        return objectStorage.getMockUploadsBaseUrl()
    }
  }

  function getIconUrls (icons: ActivityIconObject | ActivityIconObject[]) {
    return [ icons ].flat().map(i => i.url)
  }

  // ---------------------------------------------------------------------------
  // Regenerated files helpers
  // ---------------------------------------------------------------------------

  type LocalVideoSnapshot = { thumbnailUrls: string[], storyboardUrls: string[], torrentUrls: string[] }
  type RemoteVideoSnapshot = { thumbnailUrls: string[], storyboardUrls: string[] }

  function getVideoFiles (video: VideoDetails) {
    return [
      ...video.files.map(file => ({ key: 'web-video-' + file.resolution.id, file })),
      ...video.streamingPlaylists.flatMap(p => p.files.map(file => ({ key: 'hls-' + file.resolution.id, file })))
    ]
  }

  async function checkLocalVideo (options: {
    videoUUID: string
    previous?: LocalVideoSnapshot
    expectHLS?: boolean // default false
  }): Promise<LocalVideoSnapshot> {
    const { videoUUID, previous, expectHLS = false } = options

    const video = await server.videos.get({ id: videoUUID })
    const { storyboards } = await server.storyboard.list({ id: videoUUID })

    expect(video.thumbnails).to.have.length.above(0)
    for (const thumbnail of video.thumbnails) {
      expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
      await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    expect(storyboards).to.have.lengthOf(1)
    expectStartWith(storyboards[0].fileUrl, objectStorage.getMockStoryboardsBaseUrl())
    await makeRawRequest({ url: storyboards[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })

    if (expectHLS) expect(video.streamingPlaylists).to.have.lengthOf(1)

    const files = getVideoFiles(video)
    expect(files).to.have.length.above(0)

    for (const { file } of files) {
      expectStartWith(file.torrentUrl, objectStorage.getMockTorrentsBaseUrl())

      const torrent = await fetchTorrent(file.torrentUrl)
      expect(torrent.infoHash, file.torrentUrl).to.equal(getTorrentInfoHash(file.magnetUri))
      expect(torrent.name, file.torrentUrl).to.contain(video.name)
    }

    // Generated files must not be left on the file system
    for (const directory of [ 'thumbnails', 'storyboards', 'torrents' ]) {
      await checkDirectoryIsEmpty(server, directory)
    }

    const snapshot: LocalVideoSnapshot = {
      thumbnailUrls: video.thumbnails.map(t => t.fileUrl),
      storyboardUrls: storyboards.map(s => s.fileUrl),
      torrentUrls: files.map(f => f.file.torrentUrl)
    }

    if (previous) {
      // Replaced files must be removed from object storage
      const current = [ ...snapshot.thumbnailUrls, ...snapshot.storyboardUrls, ...snapshot.torrentUrls ]
      const removed = [ ...previous.thumbnailUrls, ...previous.storyboardUrls, ...previous.torrentUrls ].filter(u => !current.includes(u))

      await expectNotFound(removed)

      // Including from the legacy torrent URL
      const removedTorrents = previous.torrentUrls.filter(u => !snapshot.torrentUrls.includes(u))
      await expectNotFound(removedTorrents.map(u => server.url + '/lazy-static/torrents/' + basename(u)))
    }

    return snapshot
  }

  async function checkRemoteVideo (options: {
    videoUUID: string
    previous?: RemoteVideoSnapshot
  }): Promise<RemoteVideoSnapshot> {
    const { videoUUID, previous } = options
    const remoteServer = servers[1]

    const origin = await server.videos.get({ id: videoUUID })
    const remote = await remoteServer.videos.get({ id: videoUUID })

    expect(remote.name).to.equal(origin.name)

    await expectSameImages(remote.thumbnails, origin.thumbnails)

    const { storyboards: originStoryboards } = await server.storyboard.list({ id: videoUUID })
    const { storyboards: remoteStoryboards } = await remoteServer.storyboard.list({ id: videoUUID })

    expect(remoteStoryboards).to.have.lengthOf(originStoryboards.length)
    for (let i = 0; i < remoteStoryboards.length; i++) {
      expect(remoteStoryboards[i].totalWidth).to.equal(originStoryboards[i].totalWidth)

      await expectSimilarImage(remoteStoryboards[i].fileUrl, originStoryboards[i].fileUrl)
    }

    const originFiles = getVideoFiles(origin)
    const remoteFiles = getVideoFiles(remote)
    expect(remoteFiles.map(f => f.key).sort((a, b) => a.localeCompare(b))).to.deep.equal(
      originFiles.map(f => f.key).sort((a, b) => a.localeCompare(b))
    )

    for (const { key, file } of remoteFiles) {
      const expectedInfoHash = getTorrentInfoHash(originFiles.find(f => f.key === key).file.magnetUri)

      expect(getTorrentInfoHash(file.magnetUri), key).to.equal(expectedInfoHash)

      // The remote instance proxifies the torrent of the origin, which must be the current one
      const torrent = await fetchTorrent(file.torrentUrl)
      expect(torrent.infoHash, key).to.equal(expectedInfoHash)
    }

    const snapshot: RemoteVideoSnapshot = {
      thumbnailUrls: remote.thumbnails.map(t => t.fileUrl),
      storyboardUrls: remoteStoryboards.map(s => s.fileUrl)
    }

    if (previous) {
      // Previously cached files are not served anymore
      const current = [ ...snapshot.thumbnailUrls, ...snapshot.storyboardUrls ]
      await expectNotFound([ ...previous.thumbnailUrls, ...previous.storyboardUrls ].filter(u => !current.includes(u)))
    }

    return snapshot
  }

  async function checkPlaylistThumbnails (playlistId: string, previous?: { thumbnailUrls: string[], remoteThumbnailUrls: string[] }) {
    const playlist = await server.playlists.get({ playlistId })
    const remotePlaylist = await servers[1].playlists.get({ playlistId })

    expect(playlist.thumbnails).to.have.length.above(0)
    for (const thumbnail of playlist.thumbnails) {
      expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
      await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    await expectSameImages(remotePlaylist.thumbnails, playlist.thumbnails)
    await checkDirectoryIsEmpty(server, 'thumbnails')

    const snapshot = {
      thumbnailUrls: playlist.thumbnails.map(t => t.fileUrl),
      remoteThumbnailUrls: remotePlaylist.thumbnails.map(t => t.fileUrl)
    }

    if (previous) {
      await expectNotFound(previous.thumbnailUrls.filter(u => !snapshot.thumbnailUrls.includes(u)))
      await expectNotFound(previous.remoteThumbnailUrls.filter(u => !snapshot.remoteThumbnailUrls.includes(u)))
    }

    return snapshot
  }

  before(async function () {
    this.timeout(240000)

    await objectStorage.prepareDefaultMockBuckets()

    const disabledObjectStorageConfig = objectStorage.getDefaultMockConfig({ enabledOptionalTypes: allOptionalTypes })
    disabledObjectStorageConfig.object_storage.enabled = false

    servers = [
      await createSingleServer(1, objectStorage.getDefaultMockConfig({ enabledOptionalTypes: allOptionalTypes })),
      await createSingleServer(2, objectStorage.getDefaultMockConfig()),
      await createSingleServer(3, disabledObjectStorageConfig)
    ]
    server = servers[0]

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await setDefaultAccountAvatar(servers)

    for (const s of servers) {
      await s.config.disableTranscoding()
    }

    await doubleFollow(servers[0], servers[1])

    const { uuid: videoUUID } = await server.videos.quickUpload({ name: 'video' })
    uuid = videoUUID

    await waitJobs(servers)
  })

  describe('Actor images', function () {
    it('Should have put the account avatar in object storage', async function () {
      const me = await server.users.getMyInfo()

      expect(me.account.avatars).to.have.length.above(0)

      for (const avatar of me.account.avatars) {
        expectStartWith(avatar.fileUrl, objectStorage.getMockActorImagesBaseUrl())
        await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })

        // The file is not served by our instance anymore
        expect(avatar.path).to.be.null
      }
    })

    it('Should have put a channel banner in object storage', async function () {
      this.timeout(60000)

      await server.channels.updateImage({
        channelName: server.store.channel.name,
        fixture: 'banner.jpg',
        type: 'banner'
      })

      const channel = await server.channels.get({ channelName: server.store.channel.name })

      expect(channel.banners).to.have.length.above(0)

      for (const banner of channel.banners) {
        expectStartWith(banner.fileUrl, objectStorage.getMockActorImagesBaseUrl())
        await makeRawRequest({ url: banner.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should use object storage URLs for avatars in video objects', async function () {
      const { data } = await server.videos.list()
      const video = await server.videos.get({ id: uuid })

      for (const v of [ data.find(v => v.uuid === uuid), video ]) {
        const avatars = [ ...v.account.avatars, ...v.channel.avatars ]
        expect(avatars).to.have.length.above(0)

        for (const avatar of avatars) {
          expectStartWith(avatar.fileUrl, objectStorage.getMockActorImagesBaseUrl())
        }
      }
    })

    it('Should not have kept actor images on the file system', async function () {
      await checkDirectoryIsEmpty(server, 'avatars')
    })
  })

  describe('Thumbnails', function () {
    it('Should have put the video thumbnails in object storage', async function () {
      const video = await server.videos.get({ id: uuid })

      expect(video.thumbnails).to.have.length.above(0)

      for (const thumbnail of video.thumbnails) {
        expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      // Deprecated paths point at our instance, which does not serve the file anymore
      expect(video.thumbnailPath).to.be.null
      expect(video.previewPath).to.be.null
    })

    it('Should have put the playlist thumbnails in object storage', async function () {
      this.timeout(60000)

      const { uuid } = await server.playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id,
          thumbnailfile: 'custom-thumbnail-280x157.jpg'
        }
      })
      playlistUUID = uuid

      const playlist = await server.playlists.get({ playlistId: playlistUUID })

      expect(playlist.thumbnails).to.have.length.above(0)

      for (const thumbnail of playlist.thumbnails) {
        expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      // Deprecated path points at our instance, which does not serve the file anymore
      expect(playlist.thumbnailPath).to.be.null
    })

    it('Should not have kept thumbnails on the file system', async function () {
      await checkDirectoryIsEmpty(server, 'thumbnails')
    })
  })

  describe('Storyboards', function () {
    it('Should have put the storyboard in object storage', async function () {
      this.timeout(120000)

      await waitJobs(servers)

      const { storyboards } = await server.storyboard.list({ id: uuid })
      expect(storyboards).to.have.lengthOf(1)

      expectStartWith(storyboards[0].fileUrl, objectStorage.getMockStoryboardsBaseUrl())
      await makeRawRequest({ url: storyboards[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })

      expect(storyboards[0].storyboardPath).to.be.null
    })

    it('Should not have kept storyboards on the file system', async function () {
      await checkDirectoryIsEmpty(server, 'storyboards')
    })
  })

  describe('Torrents', function () {
    it('Should have put the torrents in object storage', async function () {
      const video = await server.videos.get({ id: uuid })
      expect(video.files).to.have.length.above(0)

      const parseTorrent = (await import('parse-torrent')).default

      for (const file of video.files) {
        expectStartWith(file.torrentUrl, objectStorage.getMockTorrentsBaseUrl())

        // The magnet URI must reference the object storage URL of the torrent
        const magnet = new URL(file.magnetUri)
        expect(magnet.searchParams.getAll('xs')).to.deep.equal([ file.torrentUrl ])

        // Old torrent URLs (before the move to object storage) are still served by our instance
        const legacyUrl = server.url + '/lazy-static/torrents/' + basename(file.torrentUrl)

        for (const url of [ file.torrentUrl, legacyUrl ]) {
          const res = await fetch(url)
          expect(res.status, url).to.equal(HttpStatusCode.OK_200)
          expect(res.headers.get('content-type'), url).to.equal('application/x-bittorrent')

          const torrent = await parseTorrent(Buffer.from(await res.arrayBuffer()))
          expect(torrent.name).to.contain(video.name)
          expect(torrent.infoHash).to.equal(magnet.searchParams.get('xt').replace('urn:btih:', ''))
        }

        // Downloads are redirected to a pre-signed object storage URL, like video files
        const downloadRes = await makeRawRequest({ url: file.torrentDownloadUrl, expectedStatus: HttpStatusCode.FOUND_302 })
        const location = downloadRes.headers['location']
        expectStartWith(location, objectStorage.getMockTorrentsBaseUrl())

        await makeRawRequest({ url: location, expectedStatus: HttpStatusCode.OK_200 })
      }
    })

    it('Should not have kept torrents on the file system', async function () {
      await checkDirectoryIsEmpty(server, 'torrents')
    })
  })

  describe('Uploads', function () {
    it('Should have put an instance logo in object storage', async function () {
      this.timeout(60000)

      await server.config.updateInstanceLogo({ fixture: 'avatar.png', type: 'favicon' })

      const config = await server.config.getConfig()
      const logo = config.instance.logo.find(l => l.type === 'favicon')

      expect(logo).to.exist
      expectStartWith(logo.fileUrl, objectStorage.getMockUploadsBaseUrl())
      await makeRawRequest({ url: logo.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should have put an SVG logo in object storage', async function () {
      this.timeout(60000)

      await server.config.updateInstanceLogo({ fixture: 'peertube.svg', type: 'header-square' })

      const config = await server.config.getConfig()
      const logo = config.instance.logo.find(l => l.type === 'header-square')

      expectStartWith(logo.fileUrl, objectStorage.getMockUploadsBaseUrl())
      await makeRawRequest({ url: logo.fileUrl, expectedStatus: HttpStatusCode.OK_200 })

      // PeerTube uploads SVG with `Content-Disposition: attachment` to prevent XSS, but s3-ninja mock drops the header
    })
  })

  describe('Disabled object storage', function () {
    for (
      const { index, title } of [
        { index: 1, title: 'When object storage is not enabled for these files' },
        { index: 2, title: 'When these files are enabled but object storage is disabled' }
      ]
    ) {
      describe(title, function () {
        let urls: Awaited<ReturnType<typeof getFileUrls>>

        before(async function () {
          this.timeout(120000)

          const s = servers[index]

          await s.channels.updateImage({ channelName: s.store.channel.name, fixture: 'banner.jpg', type: 'banner' })

          await s.playlists.create({
            attributes: {
              displayName: 'playlist',
              privacy: VideoPlaylistPrivacy.PUBLIC,
              videoChannelId: s.store.channel.id,
              thumbnailfile: 'custom-thumbnail-280x157.jpg'
            }
          })

          await s.config.updateInstanceLogo({ fixture: 'avatar.png', type: 'favicon' })

          const { uuid } = await s.videos.quickUpload({ name: 'video on file system' })
          fsVideoUUIDs[index] = uuid

          await waitJobs(servers)

          urls = await getFileUrls(s, uuid)
        })

        it('Should serve the files from the instance', async function () {
          const s = servers[index]

          for (const type of allOptionalTypes) {
            expect(urls[type], type).to.have.length.above(0)

            for (const url of urls[type]) {
              expectStartWith(url, s.url)
              await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
            }
          }

          const me = await s.users.getMyInfo()
          for (const avatar of me.account.avatars) {
            expect(avatar.path).to.not.be.null
          }

          // Not redirected to object storage
          const video = await s.videos.get({ id: fsVideoUUIDs[index] })
          for (const file of video.files) {
            await makeRawRequest({ url: file.torrentDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })
          }
        })

        it('Should have kept the files on the file system', async function () {
          const s = servers[index]

          const directories: { [type in OptionalObjectStorageType]: string } = {
            avatars: 'avatars',
            thumbnails: 'thumbnails',
            storyboards: 'storyboards',
            torrents: 'torrents',
            uploads: join('uploads', 'images')
          }

          for (const type of allOptionalTypes) {
            for (const url of urls[type]) {
              const path = join(s.servers.buildDirectory(directories[type]), basename(url))

              expect(await pathExists(path), path).to.be.true
            }
          }
        })

        it('Should not have uploaded the files to object storage', async function () {
          for (const type of allOptionalTypes) {
            for (const url of urls[type]) {
              await makeRawRequest({ url: getBucketBaseUrl(type) + basename(url), expectedStatus: HttpStatusCode.NOT_FOUND_404 })
            }
          }
        })
      })
    }
  })

  describe('Legacy URLs', function () {
    it('Should redirect lazy static URLs of files stored in object storage', async function () {
      const me = await server.users.getMyInfo()
      const channel = await server.channels.get({ channelName: server.store.channel.name })
      const video = await server.videos.get({ id: uuid })
      const { storyboards } = await server.storyboard.list({ id: uuid })

      const filesByPath = {
        '/lazy-static/avatars/': me.account.avatars.map(a => a.fileUrl),
        '/lazy-static/banners/': channel.banners.map(b => b.fileUrl),
        '/lazy-static/thumbnails/': video.thumbnails.map(t => t.fileUrl),
        '/lazy-static/storyboards/': storyboards.map(s => s.fileUrl)
      }

      for (const [ path, fileUrls ] of Object.entries(filesByPath)) {
        expect(fileUrls, path).to.have.length.above(0)

        for (const fileUrl of fileUrls) {
          const legacyUrl = server.url + path + basename(fileUrl)

          expect(await getRedirectionUrl(legacyUrl), legacyUrl).to.equal(fileUrl)
        }
      }
    })

    it('Should return 404 on the lazy static URL of a torrent missing in object storage', async function () {
      // Server 2 keeps its torrents on the file system: point one of them at an object that does not exist
      const remote = servers[1]
      const sqlCommand = new SQLCommand(remote)

      const video = await remote.videos.get({ id: fsVideoUUIDs[1] })
      const filename = basename(video.files[0].torrentUrl)
      const legacyUrl = remote.url + '/lazy-static/torrents/' + filename

      await makeRawRequest({ url: legacyUrl, expectedStatus: HttpStatusCode.OK_200 })

      try {
        await sqlCommand.setTorrentStorageOf(filename, FileStorage.OBJECT_STORAGE)

        await makeRawRequest({ url: legacyUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      } finally {
        await sqlCommand.setTorrentStorageOf(filename, FileStorage.FILE_SYSTEM)
        await sqlCommand.cleanup()
      }
    })
  })

  describe('Federation', function () {
    it('Should federate object storage URLs of images', async function () {
      {
        const { body } = await makeActivityPubGetRequest(server.url, '/accounts/root')

        expect(getIconUrls(body.icon)).to.have.length.above(0)
        for (const url of getIconUrls(body.icon)) {
          expectStartWith(url, objectStorage.getMockActorImagesBaseUrl())
        }
      }

      {
        const { body } = await makeActivityPubGetRequest(server.url, '/video-channels/' + server.store.channel.name)

        expect(getIconUrls(body.image)).to.have.length.above(0)
        for (const url of getIconUrls(body.image)) {
          expectStartWith(url, objectStorage.getMockActorImagesBaseUrl())
        }
      }

      {
        const { body } = await makeActivityPubGetRequest(server.url, '/video-playlists/' + playlistUUID)

        expect(getIconUrls(body.icon)).to.have.length.above(0)
        for (const url of getIconUrls(body.icon)) {
          expectStartWith(url, objectStorage.getMockThumbnailsBaseUrl())
        }
      }

      {
        const { body } = await makeActivityPubGetRequest(server.url, '/videos/watch/' + uuid)
        const videoObject = body as VideoObject

        expect(videoObject.icon).to.have.length.above(0)
        for (const icon of videoObject.icon) {
          expectStartWith(icon.url, objectStorage.getMockThumbnailsBaseUrl())
        }

        expect(videoObject.preview).to.have.lengthOf(1)
        expectStartWith(videoObject.preview[0].url[0].href, objectStorage.getMockStoryboardsBaseUrl())

        const torrentLinks = videoObject.url
          .filter(u => (u as ActivityBitTorrentUrlObject).mediaType === 'application/x-bittorrent') as ActivityBitTorrentUrlObject[]
        expect(torrentLinks).to.have.length.above(0)

        for (const link of torrentLinks) {
          expectStartWith(link.href, objectStorage.getMockTorrentsBaseUrl())
        }

        // Remote instances get the torrent URL from the magnet URI
        const magnetLinks = videoObject.url
          .filter(u =>
            (u as ActivityMagnetUrlObject).mediaType === 'application/x-bittorrent;x-scheme-handler/magnet'
          ) as ActivityMagnetUrlObject[]
        expect(magnetLinks).to.have.length.above(0)

        for (const link of magnetLinks) {
          expectStartWith(new URL(link.href).searchParams.get('xs'), objectStorage.getMockTorrentsBaseUrl())
        }
      }
    })

    it('Should display files stored in object storage on a remote instance', async function () {
      this.timeout(60000)

      const remote = servers[1]

      const account = await remote.accounts.get({ accountName: 'root@' + server.host })
      const channel = await remote.channels.get({ channelName: server.store.channel.name + '@' + server.host })
      const video = await remote.videos.get({ id: uuid })
      const playlist = await remote.playlists.get({ playlistId: playlistUUID })
      const { storyboards } = await remote.storyboard.list({ id: uuid })

      const urls = [
        ...account.avatars.map(a => a.fileUrl),
        ...channel.banners.map(b => b.fileUrl),
        ...video.thumbnails.map(t => t.fileUrl),
        ...playlist.thumbnails.map(t => t.fileUrl),
        ...storyboards.map(s => s.fileUrl),
        ...video.files.map(f => f.torrentUrl)
      ]

      expect(account.avatars).to.have.length.above(0)
      expect(channel.banners).to.have.length.above(0)
      expect(video.thumbnails).to.have.length.above(0)
      expect(playlist.thumbnails).to.have.length.above(0)
      expect(storyboards).to.have.lengthOf(1)
      expect(video.files).to.have.length.above(0)

      for (const url of urls) {
        // The remote instance serves them through its lazy static routes
        expectStartWith(url, remote.url)

        const { body } = await makeRawRequest({ url, responseType: 'arraybuffer', expectedStatus: HttpStatusCode.OK_200 })
        expect(body).to.not.have.lengthOf(0)
      }
    })

    it('Should cache remote files on the file system and not in object storage', async function () {
      this.timeout(60000)

      const remoteVideoUUID = fsVideoUUIDs[1]

      const account = await server.accounts.get({ accountName: 'root@' + servers[1].host })
      const video = await server.videos.get({ id: remoteVideoUUID })
      const { storyboards } = await server.storyboard.list({ id: remoteVideoUUID })

      const urlsByType: { [type in OptionalObjectStorageType]?: string[] } = {
        avatars: account.avatars.map(a => a.fileUrl),
        thumbnails: video.thumbnails.map(t => t.fileUrl),
        storyboards: storyboards.map(s => s.fileUrl),
        torrents: video.files.map(f => f.torrentUrl)
      }

      for (const type of Object.keys(urlsByType) as OptionalObjectStorageType[]) {
        expect(urlsByType[type], type).to.have.length.above(0)

        for (const url of urlsByType[type]) {
          expectStartWith(url, server.url)
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })

          await makeRawRequest({ url: getBucketBaseUrl(type) + basename(url), expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }
      }

      expect(await server.servers.countFiles(join('cache', 'avatars'))).to.be.above(0)
      expect(await server.servers.countFiles(join('cache', 'thumbnails'))).to.be.above(0)
      expect(await server.servers.countFiles(join('cache', 'storyboards'))).to.be.above(0)

      // Remote files are not considered as local files
      await checkDirectoryIsEmpty(server, 'avatars')
      await checkDirectoryIsEmpty(server, 'thumbnails')
      await checkDirectoryIsEmpty(server, 'storyboards')
      await checkDirectoryIsEmpty(server, 'torrents')
    })
  })

  describe('Regenerated video files', function () {
    // Snapshots of the previous checks, to ensure replaced files are removed
    let localSnapshot: LocalVideoSnapshot
    let remoteSnapshot: RemoteVideoSnapshot

    let videoUUID: string

    before(async function () {
      this.timeout(240000)

      await server.config.enableMinimumTranscoding()
      await server.config.enableStudio()
      await server.config.enableFileUpdate()

      const { uuid } = await server.videos.quickUpload({ name: 'regenerated video', fixture: 'video_short.webm' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should have uploaded files generated by the transcoding jobs', async function () {
      this.timeout(120000)

      localSnapshot = await checkLocalVideo({ videoUUID, expectHLS: true })
      remoteSnapshot = await checkRemoteVideo({ videoUUID })
    })

    it('Should upload new torrents when transcoding the video again', async function () {
      this.timeout(240000)

      for (const transcodingType of [ 'hls', 'web-video' ] as const) {
        await server.videos.runTranscoding({ videoId: videoUUID, transcodingType, forceTranscoding: true })
        await waitJobs(servers)
      }

      localSnapshot = await checkLocalVideo({ videoUUID, previous: localSnapshot })
      remoteSnapshot = await checkRemoteVideo({ videoUUID, previous: remoteSnapshot })
    })

    it('Should upload new thumbnails, storyboard and torrents after replacing the video source file', async function () {
      this.timeout(240000)

      await server.videos.replaceSourceFile({ videoId: videoUUID, fixture: 'video_short_360p.mp4' })
      await waitJobs(servers)

      const previous = localSnapshot

      localSnapshot = await checkLocalVideo({ videoUUID, previous })
      remoteSnapshot = await checkRemoteVideo({ videoUUID, previous: remoteSnapshot })

      expectAllReplaced(previous.thumbnailUrls, localSnapshot.thumbnailUrls)
      expectAllReplaced(previous.storyboardUrls, localSnapshot.storyboardUrls)
      expectAllReplaced(previous.torrentUrls, localSnapshot.torrentUrls)
    })

    it('Should upload a new storyboard and torrents after a studio edition', async function () {
      this.timeout(240000)

      await server.videoStudio.createEditionTasks({ videoId: videoUUID, tasks: [ { name: 'cut', options: { start: 1 } } ] })
      await waitJobs(servers)

      const previous = localSnapshot

      localSnapshot = await checkLocalVideo({ videoUUID, previous })
      remoteSnapshot = await checkRemoteVideo({ videoUUID, previous: remoteSnapshot })

      expectAllReplaced(previous.storyboardUrls, localSnapshot.storyboardUrls)
      expectAllReplaced(previous.torrentUrls, localSnapshot.torrentUrls)
    })

    it('Should upload updated torrents after a video name update', async function () {
      this.timeout(120000)

      await server.videos.update({ id: videoUUID, attributes: { name: 'regenerated video renamed' } })
      await waitJobs(servers)

      const previous = localSnapshot

      // Torrent names include the video name
      localSnapshot = await checkLocalVideo({ videoUUID, previous })
      remoteSnapshot = await checkRemoteVideo({ videoUUID, previous: remoteSnapshot })

      expectAllReplaced(previous.torrentUrls, localSnapshot.torrentUrls)
    })

    it('Should upload new thumbnails after a thumbnail update', async function () {
      this.timeout(120000)

      await server.videos.update({ id: videoUUID, attributes: { thumbnailfile: 'custom-thumbnail.png' } })
      await waitJobs(servers)

      const previous = localSnapshot

      localSnapshot = await checkLocalVideo({ videoUUID, previous })
      remoteSnapshot = await checkRemoteVideo({ videoUUID, previous: remoteSnapshot })

      expectAllReplaced(previous.thumbnailUrls, localSnapshot.thumbnailUrls)
    })

    it('Should read the thumbnail from object storage to merge an audio file, and upload the generated files', async function () {
      this.timeout(240000)

      const { uuid } = await server.videos.upload({
        attributes: { name: 'audio', fixture: 'sample.ogg', thumbnailfile: 'custom-thumbnail.png' }
      })
      await waitJobs(servers)

      const video = await server.videos.get({ id: uuid })
      expect(video.files.some(f => f.hasVideo)).to.be.true

      // The storyboard is generated from the merged video, after the transcoding job
      await checkLocalVideo({ videoUUID: uuid })
      await checkRemoteVideo({ videoUUID: uuid })
    })

    it('Should regenerate the automatic playlist thumbnail from videos in object storage', async function () {
      this.timeout(120000)

      const { uuid: otherVideoUUID } = await server.videos.quickUpload({ name: 'other video' })
      await waitJobs(servers)

      const { uuid: playlistId } = await server.playlists.create({
        attributes: { displayName: 'auto thumbnail', privacy: VideoPlaylistPrivacy.PUBLIC, videoChannelId: server.store.channel.id }
      })

      const { id: elementId } = await server.playlists.addElement({ playlistId, attributes: { videoId: videoUUID } })
      await server.playlists.addElement({ playlistId, attributes: { videoId: otherVideoUUID } })
      await waitJobs(servers)

      const previous = await checkPlaylistThumbnails(playlistId)

      // The first element changed: the thumbnail is regenerated from the new first video
      await server.playlists.removeElement({ playlistId, elementId })
      await waitJobs(servers)

      const current = await checkPlaylistThumbnails(playlistId, previous)

      expectAllReplaced(previous.thumbnailUrls, current.thumbnailUrls)
    })
  })

  describe('Replaced actor images and uploads', function () {
    it('Should upload a new avatar and remove the previous one', async function () {
      this.timeout(120000)

      const previousLocal = (await server.users.getMyInfo()).account.avatars.map(a => a.fileUrl)
      const previousRemote = (await servers[1].accounts.get({ accountName: 'root@' + server.host })).avatars.map(a => a.fileUrl)

      await server.users.updateMyAvatar({ fixture: 'avatar2.png' })
      await waitJobs(servers)

      const account = (await server.users.getMyInfo()).account
      const remoteAccount = await servers[1].accounts.get({ accountName: 'root@' + server.host })

      for (const avatar of account.avatars) {
        expectStartWith(avatar.fileUrl, objectStorage.getMockActorImagesBaseUrl())
      }

      expectAllReplaced(previousLocal, account.avatars.map(a => a.fileUrl))
      await expectNotFound(previousLocal)

      // The remote instance must not keep serving the previous cached avatar
      await expectSameImages(remoteAccount.avatars, account.avatars)
      await expectNotFound(previousRemote.filter(u => !remoteAccount.avatars.some(a => a.fileUrl === u)))

      await checkDirectoryIsEmpty(server, 'avatars')
    })

    it('Should remove a deleted banner from object storage', async function () {
      this.timeout(120000)

      const channelName = server.store.channel.name
      const previous = (await server.channels.get({ channelName })).banners.map(b => b.fileUrl)
      const previousRemote = (await servers[1].channels.get({ channelName: channelName + '@' + server.host })).banners.map(b => b.fileUrl)

      expect(previous).to.have.length.above(0)
      expect(previousRemote).to.have.length.above(0)

      await server.channels.deleteImage({ channelName, type: 'banner' })
      await waitJobs(servers)

      expect((await server.channels.get({ channelName })).banners).to.have.lengthOf(0)
      expect((await servers[1].channels.get({ channelName: channelName + '@' + server.host })).banners).to.have.lengthOf(0)

      await expectNotFound([ ...previous, ...previousRemote ])
    })

    it('Should remove the avatar and banner of a deleted user from object storage', async function () {
      this.timeout(120000)

      const { userId, token: userToken, userChannelName } = await server.users.generate('user-to-delete')

      await server.users.updateMyAvatar({ token: userToken, fixture: 'avatar.png' })
      await server.channels.updateImage({ channelName: userChannelName, token: userToken, fixture: 'banner.jpg', type: 'banner' })

      const avatars = (await server.accounts.get({ accountName: 'user-to-delete' })).avatars
      const banners = (await server.channels.get({ channelName: userChannelName })).banners

      expect(avatars).to.have.length.above(0)
      expect(banners).to.have.length.above(0)

      const avatarUrls = avatars.map(a => a.fileUrl)
      const bannerUrls = banners.map(b => b.fileUrl)

      for (const url of [ ...avatarUrls, ...bannerUrls ]) {
        expectStartWith(url, objectStorage.getMockActorImagesBaseUrl())
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
      }

      await server.users.remove({ userId })
      await waitJobs(servers)

      await expectNotFound([ ...avatarUrls, ...bannerUrls ])
    })

    it('Should upload a new logo and remove the previous one', async function () {
      this.timeout(60000)

      const getFavicons = async () => {
        const config = await server.config.getConfig()

        return config.instance.logo.filter(l => l.type === 'favicon' && !l.isFallback).map(l => l.fileUrl)
      }

      const previous = await getFavicons()
      expect(previous).to.have.length.above(0)

      await server.config.updateInstanceLogo({ fixture: 'avatar2.png', type: 'favicon' })

      const current = await getFavicons()
      expect(current).to.have.length.above(0)

      for (const url of current) {
        expectStartWith(url, objectStorage.getMockUploadsBaseUrl())
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
      }

      expectAllReplaced(previous, current)
      await expectNotFound(previous)
    })

    it('Should remove a deleted logo from object storage', async function () {
      this.timeout(60000)

      const getLogos = async () => {
        const config = await server.config.getConfig()

        return config.instance.logo.filter(l => l.type === 'header-square' && !l.isFallback).map(l => l.fileUrl)
      }

      const previous = await getLogos()
      expect(previous).to.have.length.above(0)

      await server.config.deleteInstanceLogo({ type: 'header-square' })

      expect(await getLogos()).to.have.lengthOf(0)
      await expectNotFound(previous)
    })
  })

  describe('Remote runners', function () {
    let runnerToken: string

    before(async function () {
      this.timeout(60000)

      await server.config.enableMinimumTranscoding()
      await server.config.enableRemoteTranscoding()

      runnerToken = await server.runners.autoRegisterRunner()
    })

    it('Should send the thumbnail stored in object storage to a runner merging an audio file', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.upload({
        attributes: { name: 'audio for runner', fixture: 'sample.ogg', thumbnailfile: 'custom-thumbnail-big.jpg' }
      })
      await waitJobs(servers)

      const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'vod-audio-merge-transcoding' })
      const payload = job.payload as RunnerJobVODAudioMergeTranscodingPayload

      const video = await server.videos.get({ id: uuid })
      const thumbnail = maxBy(video.thumbnails, 'width')
      expectStartWith(thumbnail.fileUrl, objectStorage.getMockThumbnailsBaseUrl())

      const { body } = await server.runnerJobs.getJobFile({ url: payload.input.previewFileUrl, jobToken: job.jobToken, runnerToken })

      expect(body).to.deep.equal(await downloadFile(thumbnail.fileUrl))
    })

    after(async function () {
      await server.runnerJobs.cancelAllJobs()
      await server.config.updateExistingConfig({ newConfig: { transcoding: { remoteRunners: { enabled: false } } } })
    })
  })

  describe('Deletion', function () {
    it('Should have removed the video files from object storage', async function () {
      this.timeout(60000)

      const video = await server.videos.get({ id: uuid })
      const thumbnailUrl = video.thumbnails[0].fileUrl
      const torrentUrl = video.files[0].torrentUrl
      const legacyTorrentUrl = server.url + '/lazy-static/torrents/' + basename(torrentUrl)

      await server.videos.remove({ id: uuid })
      await waitJobs(servers)

      await makeRawRequest({ url: thumbnailUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await makeRawRequest({ url: torrentUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await makeRawRequest({ url: legacyTorrentUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
})
