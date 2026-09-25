/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles } from '@peertube/peertube-core-utils'
import {
  FileStorage,
  FileStorageType,
  HttpStatusCode,
  HttpStatusCodeType,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled, buildUUID } from '@peertube/peertube-node-utils'
import {
  AlwaysOnObjectStorageType,
  CLICommand,
  ObjectStorageCommand,
  OptionalObjectStorageType,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { createFile, pathExists } from 'fs-extra/esm'
import { readdir } from 'fs/promises'
import { basename, join } from 'path'

describe('Test prune storage CLI', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    for (const server of servers) {
      await server.config.enableMinimumTranscoding({ keepOriginal: true })
      await server.config.enableUserExport()
    }

    for (const server of servers) {
      await server.videos.quickUpload({ name: 'video 1', privacy: VideoPrivacy.PUBLIC })
      const { uuid } = await server.videos.quickUpload({ name: 'video 2', privacy: VideoPrivacy.PUBLIC })

      await server.videos.quickUpload({ name: 'video 3', privacy: VideoPrivacy.PRIVATE })

      await server.captions.add({
        language: 'ar',
        videoId: uuid,
        fixture: 'subtitle-good1.vtt'
      })

      await server.users.updateMyAvatar({ fixture: 'avatar.png' })
      await server.config.updateInstanceLogo({ fixture: 'avatar.png', type: 'favicon' })

      await server.playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id,
          thumbnailfile: 'custom-thumbnail-280x157.jpg'
        }
      })
    }

    for (const server of servers) {
      const user = await server.users.getMyInfo()

      await server.userExports.request({ userId: user.id, withVideoFiles: false })
    }

    await doubleFollow(servers[0], servers[1])
  })

  describe('On filesystem', function () {
    const badCommonNames: { [directory: string]: string[] } = {}
    const badTmpPersistentNames: { [directory: string]: string[] } = {}

    async function assertNotExists (server: PeerTubeServer, directory: string, substring: string) {
      const files = await readdir(server.servers.buildDirectory(directory))

      for (const f of files) {
        expect(f).to.not.contain(substring)
      }
    }

    async function checkLocalFilesCount () {
      const server = servers[0]

      const videosCount = await server.servers.countFiles('web-videos')
      expect(videosCount).to.equal(5) // 2 videos with 2 resolutions + private directory

      const privateVideosCount = await server.servers.countFiles('web-videos/private')
      expect(privateVideosCount).to.equal(2)

      const torrentsCount = await server.servers.countFiles('torrents')
      expect(torrentsCount).to.equal(12)

      const thumbnailsCount = await server.servers.countFiles('thumbnails')
      // 15 of 3 local videos + 1 playlist (5 sizes for each)
      expect(thumbnailsCount).to.equal(20)

      const avatarsCount = await server.servers.countFiles('avatars')
      expect(avatarsCount).to.equal(4)

      const hlsRootCount = await server.servers.countFiles(join('streaming-playlists', 'hls'))
      expect(hlsRootCount).to.equal(3) // 2 videos + private directory

      const hlsPrivateRootCount = await server.servers.countFiles(join('streaming-playlists', 'hls', 'private'))
      expect(hlsPrivateRootCount).to.equal(1)

      const originalVideoFilesCount = await server.servers.countFiles('original-video-files')
      expect(originalVideoFilesCount).to.equal(3)

      const storyboardsCount = await server.servers.countFiles('storyboards')
      expect(storyboardsCount).to.equal(3)

      const captionsCount = await server.servers.countFiles('captions')
      expect(captionsCount).to.equal(1)

      const uploadImagesCount = await server.servers.countFiles(join('uploads', 'images'))
      expect(uploadImagesCount).to.equal(1) // Instance favicon
    }

    async function checkCacheFilesCountBeforeLazyLoad () {
      expect(await servers[0].servers.countFiles(join('cache', 'avatars'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'storyboards'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'thumbnails'))).to.equal(0)
      expect(await servers[0].servers.countFiles(join('cache', 'video-captions'))).to.equal(0)
    }

    async function checkCacheFilesCountAfterLazyLoad () {
      expect(await servers[0].servers.countFiles(join('cache', 'avatars'))).to.equal(4)
      expect(await servers[0].servers.countFiles(join('cache', 'storyboards'))).to.equal(2)
      expect(await servers[0].servers.countFiles(join('cache', 'thumbnails'))).to.equal(10)
      expect(await servers[0].servers.countFiles(join('cache', 'video-captions'))).to.equal(1)
    }

    it('Should have the files on the disk', async function () {
      await checkLocalFilesCount()
      await checkCacheFilesCountBeforeLazyLoad()

      const userExportFilesCount = await servers[0].servers.countFiles('tmp-persistent')
      expect(userExportFilesCount).to.equal(1)
    })

    it('Should lazy load remote files', async function () {
      // Lazy load remote avatars
      {
        const account = await servers[0].accounts.get({ accountName: 'root@' + servers[1].host })

        for (const avatar of account.avatars) {
          await makeRawRequest({ url: avatar.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }

      // Lazy load video captions, storyboards and thumbnails
      {
        const { data: videos } = await servers[0].videos.list()
        expect(videos).to.have.lengthOf(4)

        for (const video of videos) {
          const { data: captions } = await servers[0].captions.list({ videoId: video.uuid })
          const { storyboards } = await servers[0].storyboard.list({ id: video.uuid })

          for (const caption of captions) {
            await makeRawRequest({ url: caption.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          }

          for (const storyboard of storyboards) {
            await makeRawRequest({ url: storyboard.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          }

          for (const thumbnail of video.thumbnails) {
            await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          }
        }
      }

      await checkLocalFilesCount()
      await checkCacheFilesCountAfterLazyLoad()
    })

    it('Should create some dirty files', async function () {
      for (let i = 0; i < 2; i++) {
        {
          const basePublic = servers[0].servers.buildDirectory('web-videos')
          const basePrivate = servers[0].servers.buildDirectory(join('web-videos', 'private'))

          const n1 = buildUUID() + '.mp4'
          const n2 = buildUUID() + '.webm'

          await createFile(join(basePublic, n1))
          await createFile(join(basePublic, n2))
          await createFile(join(basePrivate, n1))
          await createFile(join(basePrivate, n2))

          badCommonNames['web-videos'] = [ n1, n2 ]
        }

        {
          const base = servers[0].servers.buildDirectory('torrents')

          const n1 = buildUUID() + '-240.torrent'
          const n2 = buildUUID() + '-480.torrent'

          await createFile(join(base, n1))
          await createFile(join(base, n2))

          badCommonNames['torrents'] = [ n1, n2 ]
        }

        for (const name of [ 'thumbnails', 'avatars', 'storyboards' ]) {
          const base = servers[0].servers.buildDirectory(name)

          const n1 = buildUUID() + '.png'
          const n2 = buildUUID() + '.jpg'

          await createFile(join(base, n1))
          await createFile(join(base, n2))

          badCommonNames[name] = [ n1, n2 ]
        }

        {
          const directory = join('streaming-playlists', 'hls')
          const basePublic = servers[0].servers.buildDirectory(directory)
          const basePrivate = servers[0].servers.buildDirectory(join(directory, 'private'))

          const n1 = buildUUID()
          await createFile(join(basePublic, n1))
          await createFile(join(basePrivate, n1))
          badCommonNames[directory] = [ n1 ]
        }

        {
          const base = servers[0].servers.buildDirectory('original-video-files')

          const n1 = buildUUID() + '.mp4'
          await createFile(join(base, n1))

          badCommonNames['original-video-files'] = [ n1 ]
        }

        {
          const base = servers[0].servers.buildDirectory('captions')

          const n1 = buildUUID() + '.vtt'
          const n2 = buildUUID() + '.srt'

          await createFile(join(base, n1))
          await createFile(join(base, n2))

          badCommonNames['captions'] = [ n1, n2 ]
        }

        {
          const directory = join('uploads', 'images')
          const base = servers[0].servers.buildDirectory(directory)

          const n1 = buildUUID() + '.png'
          const n2 = buildUUID() + '.svg'

          await createFile(join(base, n1))
          await createFile(join(base, n2))

          badCommonNames[directory] = [ n1, n2 ]
        }

        {
          const base = servers[0].servers.buildDirectory('tmp-persistent')

          const n1 = 'user-export-1.zip'
          const n2 = 'user-export-2.zip'

          await createFile(join(base, n1))
          await createFile(join(base, n2))

          badTmpPersistentNames['tmp-persistent'] = [ n1, n2 ]
        }
      }
    })

    it('Should run prune storage', async function () {
      this.timeout(30000)

      const env = servers[0].cli.getEnv()
      await CLICommand.exec(`echo y | ${env} npm run prune-storage`)
    })

    it('Should have removed files', async function () {
      await checkLocalFilesCount()
      await checkCacheFilesCountAfterLazyLoad()

      // Must use the --offline option to also remove files from this directory
      const userExportFilesCount = await servers[0].servers.countFiles('tmp-persistent')
      expect(userExportFilesCount).to.equal(3)

      for (const directory of Object.keys(badCommonNames)) {
        for (const name of badCommonNames[directory]) {
          await assertNotExists(servers[0], directory, name)
        }
      }
    })

    it('Should remove files with `--offline` option', async function () {
      const env = servers[0].cli.getEnv()

      await CLICommand.exec(`echo y | ${env} npm run prune-storage -- --offline`)

      await checkLocalFilesCount()
      await checkCacheFilesCountAfterLazyLoad()

      // Must use the --offline option to also remove files from this directory
      const userExportFilesCount = await servers[0].servers.countFiles('tmp-persistent')
      expect(userExportFilesCount).to.equal(1)

      for (const directory of Object.keys(badTmpPersistentNames)) {
        for (const name of badTmpPersistentNames[directory]) {
          await assertNotExists(servers[0], directory, name)
        }
      }
    })

    it('Should remove local files that the database stores in object storage', async function () {
      this.timeout(60000)

      const server = servers[0]
      const sqlCommand = new SQLCommand(server)

      const { data: videos } = await server.videos.list()
      const video = await server.videos.get({ id: videos.find(v => v.isLocal && v.name === 'video 2').uuid })

      const { data: captions } = await server.captions.list({ videoId: video.uuid })
      const { storyboards } = await server.storyboard.list({ id: video.uuid })
      const me = await server.users.getMyInfo()
      const config = await server.config.getConfig()

      const images = [
        { directory: 'thumbnails', table: 'thumbnail' as const, filename: basename(video.thumbnails[0].fileUrl) },
        { directory: 'avatars', table: 'actorImage' as const, filename: basename(me.account.avatars[0].fileUrl) },
        { directory: 'storyboards', table: 'storyboard' as const, filename: basename(storyboards[0].fileUrl) },
        {
          directory: join('uploads', 'images'),
          table: 'uploadImage' as const,
          filename: basename(config.instance.logo.find(l => !l.isFallback && l.type === 'favicon').fileUrl)
        }
      ]
      const torrentFilename = basename(video.files[0].torrentUrl)

      const files = [
        ...images,
        { directory: 'torrents', filename: torrentFilename },
        { directory: 'captions', filename: basename(captions[0].fileUrl) }
      ]

      // A file can still be on the disk after a move to object storage, if the move job did not delete it
      const setStorage = async (storage: FileStorageType) => {
        for (const { table, filename } of images) {
          await sqlCommand.setImageStorageOf(table, filename, storage)
        }

        await sqlCommand.setTorrentStorageOf(torrentFilename, storage)
        await sqlCommand.setCaptionStorageOf(video.id, captions[0].language.id, storage)
      }

      try {
        for (const { directory, filename } of files) {
          expect(await pathExists(join(server.servers.buildDirectory(directory), filename)), filename).to.be.true
        }

        await setStorage(FileStorage.OBJECT_STORAGE)
        await CLICommand.exec(`echo y | ${server.cli.getEnv()} npm run prune-storage`)

        for (const { directory, filename } of files) {
          expect(await pathExists(join(server.servers.buildDirectory(directory), filename)), filename).to.be.false
        }

        // Other files of the same entities are kept
        expect(await pathExists(join(server.servers.buildDirectory('thumbnails'), basename(video.thumbnails[1].fileUrl)))).to.be.true
        expect(await pathExists(join(server.servers.buildDirectory('avatars'), basename(me.account.avatars[1].fileUrl)))).to.be.true
        expect(await pathExists(join(server.servers.buildDirectory('torrents'), basename(video.files[1].torrentUrl)))).to.be.true
      } finally {
        // Keep the database consistent for the next tests
        await setStorage(FileStorage.FILE_SYSTEM)
        await sqlCommand.cleanup()
      }
    })
  })

  describe('On object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const videos: string[] = []

    const objectStorage = new ObjectStorageCommand()

    const videoFileUrls: { [uuid: string]: string[] } = {}
    const sourceFileUrls: { [uuid: string]: string } = {}
    const captionFileUrls: { [uuid: string]: { [language: string]: string } } = {}

    let sqlCommand: SQLCommand
    let rootId: number
    let captionVideoId: number

    // Private files are not proxified: make them readable anonymously so the tests can fetch their direct object storage URLs
    function buildConfig (disabledTypes: AlwaysOnObjectStorageType[] = []) {
      return objectStorage.getDefaultMockConfig({ proxifyPrivateFiles: false, privateACL: 'public-read', disabledTypes })
    }

    async function execPruneStorage (disabledTypes: AlwaysOnObjectStorageType[] = []) {
      const env = servers[0].cli.getEnv(buildConfig(disabledTypes))

      await servers[0].cli.execWithEnv(`${env} npm run prune-storage -- -y`)
    }

    async function checkVideosFiles (uuids: string[], expectedStatus: HttpStatusCodeType) {
      for (const uuid of uuids) {
        // Direct object storage URLs: the mock refuses requests with a PeerTube token
        for (const url of videoFileUrls[uuid]) {
          await makeRawRequest({ url, expectedStatus })
        }

        await makeRawRequest({ url: sourceFileUrls[uuid], redirects: 1, token: servers[0].accessToken, expectedStatus })
      }
    }

    async function checkCaptionFiles (uuids: string[], languages: string[], expectedStatus: HttpStatusCodeType) {
      for (const uuid of uuids) {
        for (const language of languages) {
          await makeRawRequest({ url: captionFileUrls[uuid][language], expectedStatus })
        }
      }
    }

    async function checkUserExport (expectedStatus: HttpStatusCodeType) {
      const { data: userExports } = await servers[0].userExports.list({ userId: rootId })
      const userExportUrl = userExports[0].privateDownloadUrl

      await makeRawRequest({ url: userExportUrl, token: servers[0].accessToken, redirects: 1, expectedStatus })
    }

    before(async function () {
      this.timeout(120000)

      sqlCommand = new SQLCommand(servers[0])

      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(buildConfig())

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 's3 video 1', privacy: VideoPrivacy.PUBLIC })
        videos.push(uuid)
      }

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 's3 video 2', privacy: VideoPrivacy.PUBLIC })
        videos.push(uuid)
      }

      {
        const { id, uuid } = await servers[0].videos.quickUpload({ name: 's3 video 3', privacy: VideoPrivacy.PRIVATE })

        await servers[0].captions.add({ language: 'ar', videoId: uuid, fixture: 'subtitle-good1.vtt' })

        await servers[0].captions.add({ language: 'zh', videoId: uuid, fixture: 'subtitle-good1.vtt' })
        captionVideoId = id

        videos.push(uuid)
      }

      const user = await servers[0].users.getMyInfo()
      rootId = user.id

      await servers[0].userExports.deleteAllArchives({ userId: rootId })
      await servers[0].userExports.request({ userId: rootId, withVideoFiles: false })

      await waitJobs([ servers[0] ])

      // Grab all file URLs
      for (const uuid of videos) {
        const video = await servers[0].videos.getWithToken({ id: uuid })

        videoFileUrls[uuid] = getAllFiles(video).map(f => f.fileUrl)

        const source = await servers[0].videos.getSource({ id: uuid })
        sourceFileUrls[uuid] = source.fileDownloadUrl

        const { data: captions } = await servers[0].captions.list({ videoId: uuid, token: servers[0].accessToken })
        if (!captionFileUrls[uuid]) captionFileUrls[uuid] = {}

        for (const caption of captions) {
          captionFileUrls[uuid][caption.language.id] = caption.fileUrl
        }
      }
    })

    it('Should have the files on object storage', async function () {
      await checkVideosFiles(videos, HttpStatusCode.OK_200)
      await checkUserExport(HttpStatusCode.OK_200)
      await checkCaptionFiles([ videos[2] ], [ 'ar', 'zh' ], HttpStatusCode.OK_200)
    })

    it('Should run prune-storage script on videos', async function () {
      await sqlCommand.setVideoFileStorageOf(videos[1], FileStorage.FILE_SYSTEM)
      await sqlCommand.setVideoFileStorageOf(videos[2], FileStorage.FILE_SYSTEM)

      await execPruneStorage()

      await checkVideosFiles([ videos[1], videos[2] ], HttpStatusCode.NOT_FOUND_404)
      await checkVideosFiles([ videos[0] ], HttpStatusCode.OK_200)

      await checkUserExport(HttpStatusCode.OK_200)
      await checkCaptionFiles([ videos[2] ], [ 'ar', 'zh' ], HttpStatusCode.OK_200)
    })

    it('Should run prune-storage script on exports', async function () {
      await sqlCommand.setUserExportStorageOf(rootId, FileStorage.FILE_SYSTEM)
      await execPruneStorage()

      await checkUserExport(HttpStatusCode.NOT_FOUND_404)
      await checkCaptionFiles([ videos[2] ], [ 'ar', 'zh' ], HttpStatusCode.OK_200)
    })

    it('Should run prune-storage script on captions', async function () {
      await sqlCommand.setCaptionStorageOf(captionVideoId, 'zh', FileStorage.FILE_SYSTEM)
      await execPruneStorage()

      await checkCaptionFiles([ videos[2] ], [ 'ar' ], HttpStatusCode.OK_200)
      await checkCaptionFiles([ videos[2] ], [ 'zh' ], HttpStatusCode.NOT_FOUND_404)
    })

    it('Should not prune the captions bucket if object_storage.captions.enabled is false', async function () {
      await sqlCommand.setCaptionStorageOf(captionVideoId, 'ar', FileStorage.FILE_SYSTEM)

      await execPruneStorage([ 'captions' ])

      await checkCaptionFiles([ videos[2] ], [ 'ar' ], HttpStatusCode.OK_200)
    })

    after(async function () {
      await objectStorage.cleanupMock()
      await sqlCommand.cleanup()
    })
  })

  describe('On object storage for avatars, thumbnails, storyboards, torrents and uploads', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()
    const allOptionalTypes: OptionalObjectStorageType[] = [ 'avatars', 'thumbnails', 'storyboards', 'torrents', 'uploads' ]

    let sqlCommand: SQLCommand

    // Files the tests mark as not in object storage in the database, so they become unknown objects
    const pruned: { url: string, setStorage: (storage: FileStorageType) => Promise<void> }[] = []
    // Files of the same entities that must not be pruned
    const kept: string[] = []

    function buildConfig (enabledOptionalTypes: OptionalObjectStorageType[]) {
      return objectStorage.getDefaultMockConfig({ proxifyPrivateFiles: false, enabledOptionalTypes })
    }

    function execPruneStorage (enabledOptionalTypes: OptionalObjectStorageType[]) {
      return servers[0].cli.execWithEnv(`npm run prune-storage -- -y`, buildConfig(enabledOptionalTypes))
    }

    async function checkUrls (urls: string[], expectedStatus: HttpStatusCodeType) {
      for (const url of urls) {
        await makeRawRequest({ url, expectedStatus })
      }
    }

    before(async function () {
      this.timeout(120000)

      const server = servers[0]
      sqlCommand = new SQLCommand(server)

      await objectStorage.prepareDefaultMockBuckets()

      await server.kill()
      await server.run(buildConfig(allOptionalTypes))

      await server.users.updateMyAvatar({ fixture: 'avatar.png' })
      await server.config.updateInstanceLogo({ fixture: 'avatar.png', type: 'favicon' })

      const { uuid } = await server.videos.quickUpload({ name: 's3 images video', privacy: VideoPrivacy.PUBLIC })
      await waitJobs([ server ])

      const video = await server.videos.get({ id: uuid })
      const { storyboards } = await server.storyboard.list({ id: uuid })
      const me = await server.users.getMyInfo()
      const config = await server.config.getConfig()

      const avatars = me.account.avatars
      const logo = config.instance.logo.find(l => !l.isFallback && l.type === 'favicon')

      for (
        const url of [
          ...avatars.map(a => a.fileUrl),
          logo.fileUrl,
          video.thumbnails[0].fileUrl,
          storyboards[0].fileUrl,
          video.files[0].torrentUrl
        ]
      ) {
        expect(url.startsWith('http://') && !url.startsWith(server.url), url).to.be.true
      }

      const addImage = (table: 'actorImage' | 'thumbnail' | 'storyboard' | 'uploadImage', url: string) => {
        pruned.push({ url, setStorage: storage => sqlCommand.setImageStorageOf(table, basename(url), storage) })
      }

      addImage('actorImage', avatars[0].fileUrl)
      addImage('thumbnail', video.thumbnails[0].fileUrl)
      addImage('storyboard', storyboards[0].fileUrl)
      addImage('uploadImage', logo.fileUrl)

      const torrentUrl = video.files[0].torrentUrl
      pruned.push({
        url: torrentUrl,
        setStorage: storage => sqlCommand.setTorrentStorageOf(basename(torrentUrl), storage)
      })

      kept.push(avatars[1].fileUrl)
      kept.push(video.thumbnails[1].fileUrl)
      kept.push(video.files[1].torrentUrl)
    })

    it('Should have the files on object storage', async function () {
      await checkUrls([ ...pruned.map(p => p.url), ...kept ], HttpStatusCode.OK_200)
    })

    it('Should not prune the files of object storage types that are not enabled', async function () {
      this.timeout(60000)

      for (const { setStorage } of pruned) {
        await setStorage(FileStorage.FILE_SYSTEM)
      }

      await execPruneStorage([])

      await checkUrls([ ...pruned.map(p => p.url), ...kept ], HttpStatusCode.OK_200)
    })

    it('Should start the instance but refuse to prune object storage sections sharing a location', async function () {
      this.timeout(120000)

      const server = servers[0]

      // Thumbnails in the avatars bucket, without prefix: pruning one of them would delete the files of the other
      const config = buildConfig(allOptionalTypes)
      config.object_storage.thumbnails.bucket_name = objectStorage.getMockActorImagesBucketName()

      await server.kill()
      await server.run(config)

      await server.servers.waitUntilLog('object_storage.avatars and object_storage.thumbnails use the same bucket')

      try {
        const err = await server.cli.execWithEnv(`npm run prune-storage -- -y`, config)
          .then(() => undefined, err => err as Error)

        expect(err).to.exist
        expect(err.message).to.contain('Cannot prune object storage')
        expect(err.message).to.contain('object_storage.avatars and object_storage.thumbnails use the same bucket')

        // Avatars without prefix would also list the thumbnails stored under a prefix of the same bucket
        const nestedConfig = buildConfig(allOptionalTypes)
        nestedConfig.object_storage.thumbnails.bucket_name = objectStorage.getMockActorImagesBucketName()
        nestedConfig.object_storage.thumbnails.prefix = 'thumbnails/'

        const nestedErr = await server.cli.execWithEnv(`npm run prune-storage -- -y`, nestedConfig)
          .then(() => undefined, err => err as Error)

        expect(nestedErr).to.exist
        expect(nestedErr.message).to.contain('Cannot prune object storage')
        expect(nestedErr.message).to.contain(
          'object_storage.avatars and object_storage.thumbnails use the same bucket ' +
            `${objectStorage.getMockActorImagesBucketName()} with overlapping prefixes (no prefix and prefix thumbnails/)`
        )

        // Nothing has been deleted
        await checkUrls([ ...pruned.map(p => p.url), ...kept ], HttpStatusCode.OK_200)
      } finally {
        await server.kill()
        await server.run(buildConfig(allOptionalTypes))
      }
    })

    it('Should prune unknown files', async function () {
      this.timeout(60000)

      await execPruneStorage(allOptionalTypes)

      await checkUrls(pruned.map(p => p.url), HttpStatusCode.NOT_FOUND_404)
      await checkUrls(kept, HttpStatusCode.OK_200)
    })

    after(async function () {
      await objectStorage.cleanupMock()
      await sqlCommand.cleanup()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
