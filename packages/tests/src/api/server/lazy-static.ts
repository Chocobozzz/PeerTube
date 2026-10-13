/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await,@typescript-eslint/no-floating-promises */

import { wait } from '@peertube/peertube-core-utils'
import { FileStorage, FileStorageType, HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  createSecondaryServer,
  createSingleServer,
  doubleFollow,
  getRedirectionUrl,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { remove } from 'fs-extra/esm'
import { basename, join } from 'path'

type CacheDirectory = 'thumbnails' | 'avatars' | 'storyboards' | 'video-captions'

function runSuite (options: { objectStorage: boolean }) {
  // Server 2 caches the files of server 1
  let servers: PeerTubeServer[]
  let videoId: string

  const objectStorage = new ObjectStorageCommand()

  function getServer2Config () {
    return options.objectStorage
      ? objectStorage.getDefaultMockConfig()
      : {}
  }

  async function countCachedFiles (directory: CacheDirectory) {
    const onFS = await servers[1].servers.countFiles(join('cache', directory))
    if (!options.objectStorage) return onFS

    // Other processes could not serve files cached on the file system
    expect(onFS, directory).to.equal(0)

    const keys = await objectStorage.listMockObjectKeys(objectStorage.getMockCacheBucketName(), 'cache/' + directory + '/')

    return keys.length
  }

  async function listRemoteFileUrls () {
    const video = await servers[1].videos.get({ id: videoId })
    const { storyboards } = await servers[1].storyboard.list({ id: video.uuid })
    const { data: captions } = await servers[1].captions.list({ videoId: video.uuid })

    const { data: accounts } = await servers[1].accounts.list()
    const { data: channels } = await servers[1].channels.list()

    return [
      ...video.thumbnails.map(t => t.fileUrl),
      ...storyboards.map(s => s.fileUrl),
      ...captions.map(c => c.fileUrl),
      ...[ ...accounts, ...channels ].flatMap(({ avatars }) => avatars.map(a => a.fileUrl))
    ]
  }

  async function fetchRemoteData () {
    for (const url of await listRemoteFileUrls()) {
      await makeRawRequest({ url, redirects: 1, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  async function checkCachedFiles (checkOptions: { populated: boolean }) {
    if (checkOptions.populated) {
      expect(await countCachedFiles('thumbnails')).to.equal(5)
      expect(await countCachedFiles('avatars')).to.equal(2 * 4)
      expect(await countCachedFiles('storyboards')).to.equal(1)
      expect(await countCachedFiles('video-captions')).to.equal(1)
    } else {
      expect(await countCachedFiles('thumbnails')).to.equal(0)
      expect(await countCachedFiles('avatars')).to.equal(0)
      expect(await countCachedFiles('storyboards')).to.equal(0)
      expect(await countCachedFiles('video-captions')).to.equal(0)
    }
  }

  before(async function () {
    this.timeout(240000)

    if (options.objectStorage) await objectStorage.prepareDefaultMockBuckets()

    servers = [
      await createSingleServer(1),
      await createSingleServer(2, getServer2Config())
    ]

    await setAccessTokensToServers(servers)
    await setDefaultAccountAvatar(servers)
    await setDefaultChannelAvatar(servers)

    await servers[0].config.enableFileUpdate()

    await doubleFollow(servers[0], servers[1])

    const { uuid } = await servers[0].videos.upload({
      attributes: {
        name: 'video',
        thumbnailfile: 'custom-thumbnail-big.jpg'
      }
    })
    videoId = uuid

    await servers[0].captions.add({
      language: 'ar',
      videoId: uuid,
      fixture: 'subtitle-good1.vtt'
    })

    await waitJobs(servers)
  })

  it('Should remove previous data after an update', async function () {
    this.timeout(60000)

    await checkCachedFiles({ populated: false })

    await fetchRemoteData()

    await checkCachedFiles({ populated: true })

    // Will re-generate thumbnails and storyboard
    await servers[0].videos.replaceSourceFile({ videoId, fixture: 'video_short_360p.mp4' })

    await servers[0].captions.add({
      language: 'ar',
      videoId,
      fixture: 'subtitle-good2.vtt'
    })
    await waitJobs(servers)

    await fetchRemoteData()
    await checkCachedFiles({ populated: true })
  })

  it('Should miss an update, but re-fetch the files on 404 error', async function () {
    this.timeout(60000)

    const updateServer1Files = async () => {
      await servers[0].videos.update({ id: videoId, attributes: { thumbnailfile: 'custom-thumbnail.png' } })
      await servers[0].users.updateMyAvatar({ fixture: 'custom-thumbnail.png' })
      await waitJobs([ servers[0] ])
    }

    const testLazyStatic = async (expectedStatus: HttpStatusCodeType) => {
      const video = await servers[1].videos.get({ id: videoId })
      await makeRawRequest({ url: video.thumbnails[0].fileUrl, redirects: 1, expectedStatus })

      const user = await servers[1].accounts.get({ accountName: 'root@' + servers[0].host })
      await makeRawRequest({ url: user.avatars[0].fileUrl, redirects: 1, expectedStatus })
    }

    // Invalidate server 2 cache
    await updateServer1Files()
    await servers[1].kill()

    // Server 2 miss another update
    await updateServer1Files()

    await servers[1].run(getServer2Config())

    // Wait video info expiration
    await wait(5000)

    await testLazyStatic(HttpStatusCode.NOT_FOUND_404)
    await waitJobs(servers)
    await testLazyStatic(HttpStatusCode.OK_200)
  })

  it('Should download a remote file again in the same request if its cached copy has been removed', async function () {
    this.timeout(60000)

    await fetchRemoteData()

    const video = await servers[1].videos.get({ id: videoId })
    const thumbnailUrl = video.thumbnails[0].fileUrl
    const filename = basename(new URL(thumbnailUrl).pathname)

    if (options.objectStorage) {
      await objectStorage.removeMockObject(objectStorage.getMockCacheBucketName(), 'cache/thumbnails/' + filename)
      expect(await countCachedFiles('thumbnails')).to.equal(4)

      // The process checks a cached object once, then keeps its location in memory
      await servers[1].kill()
      await servers[1].run(getServer2Config())
    } else {
      await remove(servers[1].servers.buildDirectory(join('cache', 'thumbnails', filename)))
    }

    await makeRawRequest({ url: thumbnailUrl, redirects: 1, expectedStatus: HttpStatusCode.OK_200 })

    expect(await countCachedFiles('thumbnails')).to.equal(5)
  })

  it('Should still have files after a server restart', async function () {
    this.timeout(60000)

    await fetchRemoteData()

    await servers[0].kill()
    await servers[0].run()

    await checkCachedFiles({ populated: true })
  })

  if (options.objectStorage) {
    it('Should share the cached files with a secondary process', async function () {
      this.timeout(120000)

      const secondary = await createSecondaryServer(servers[1])
      const onSecondary = (url: string) => secondary.url + new URL(url).pathname

      // Cached by the primary (local avatars of server 2 are served by object storage)
      const cachedUrls = (await listRemoteFileUrls()).filter(u => u.startsWith(servers[1].url))
      expect(cachedUrls).to.have.length.above(0)

      for (const url of cachedUrls) {
        const location = await getRedirectionUrl(url)
        expectStartWith(location, objectStorage.getMockCacheBaseUrl() + 'cache/')

        expect(await getRedirectionUrl(onSecondary(url))).to.equal(location)

        // Public object
        await makeRawRequest({ url: location, expectedStatus: HttpStatusCode.OK_200 })
      }

      // Cached by the secondary
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video cached by the secondary' })
      await waitJobs(servers)

      const { thumbnails } = await servers[1].videos.get({ id: uuid })
      expect(thumbnails).to.have.length.above(0)

      for (const { fileUrl } of thumbnails) {
        const location = await getRedirectionUrl(onSecondary(fileUrl))
        await makeRawRequest({ url: location, expectedStatus: HttpStatusCode.OK_200 })

        expect(await getRedirectionUrl(fileUrl)).to.equal(location)
      }

      expect(await countCachedFiles('thumbnails')).to.equal(5 + thumbnails.length)

      await secondary.kill()

      await servers[0].videos.remove({ id: uuid })
      await waitJobs(servers)

      expect(await countCachedFiles('thumbnails')).to.equal(5)
    })
  }

  it('Should remove the video and remove cached files', async function () {
    this.timeout(60000)

    await servers[0].videos.remove({ id: videoId })
    await waitJobs(servers)

    expect(await countCachedFiles('thumbnails')).to.equal(0)
    expect(await countCachedFiles('avatars')).to.equal(2 * 4)
    expect(await countCachedFiles('storyboards')).to.equal(0)
    expect(await countCachedFiles('video-captions')).to.equal(0)
  })

  after(async function () {
    await cleanupTests(servers)

    if (options.objectStorage) await objectStorage.cleanupMock()
  })
}

// Server 2 caches the files of server 1, and enables then disables object storage
function runStorageSwitchSuite () {
  let servers: PeerTubeServer[]
  let sqlCommand: SQLCommand
  let thumbnailUrls: string[]

  const objectStorage = new ObjectStorageCommand()

  async function countCachedThumbnailRows (storage: FileStorageType) {
    const [ { total } ] = await sqlCommand.selectQuery<{ total: string }>(
      'SELECT COUNT(*) AS "total" FROM "thumbnail" WHERE "cached" IS TRUE AND "fileUrl" IS NOT NULL AND "storage" = :storage',
      { storage }
    )

    return parseInt(total)
  }

  async function checkCachedThumbnails (storage: FileStorageType) {
    const onFS = await servers[1].servers.countFiles(join('cache', 'thumbnails'))
    const inObjectStorage = await objectStorage.listMockObjectKeys(objectStorage.getMockCacheBucketName(), 'cache/thumbnails/')

    if (storage === FileStorage.FILE_SYSTEM) {
      expect(onFS).to.equal(thumbnailUrls.length)
    } else {
      expect(onFS).to.equal(0)
      expect(inObjectStorage).to.have.lengthOf(thumbnailUrls.length)
    }

    expect(await countCachedThumbnailRows(storage)).to.equal(thumbnailUrls.length)
  }

  async function fetchThumbnails () {
    for (const url of thumbnailUrls) {
      await makeRawRequest({ url, redirects: 1, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  async function restartServer2 (config: object) {
    await servers[1].kill()
    await servers[1].run(config)
  }

  before(async function () {
    this.timeout(240000)

    await objectStorage.prepareDefaultMockBuckets()

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    await waitJobs(servers)

    const video = await servers[1].videos.get({ id: uuid })
    thumbnailUrls = video.thumbnails.map(t => t.fileUrl)
    expect(thumbnailUrls).to.have.length.above(0)

    sqlCommand = new SQLCommand(servers[1])
  })

  it('Should cache remote files on the file system', async function () {
    await fetchThumbnails()

    await checkCachedThumbnails(FileStorage.FILE_SYSTEM)
  })

  it('Should reset the cache when object storage is enabled', async function () {
    this.timeout(60000)

    await restartServer2(objectStorage.getDefaultMockConfig())

    expect(await servers[1].servers.countFiles(join('cache', 'thumbnails'))).to.equal(0)
    expect(await countCachedThumbnailRows(FileStorage.FILE_SYSTEM)).to.equal(0)

    await fetchThumbnails()

    await checkCachedThumbnails(FileStorage.OBJECT_STORAGE)
  })

  it('Should keep the cache after a restart with the same storage', async function () {
    this.timeout(60000)

    await restartServer2(objectStorage.getDefaultMockConfig())

    await checkCachedThumbnails(FileStorage.OBJECT_STORAGE)
  })

  it('Should reset the cache when object storage is disabled', async function () {
    this.timeout(60000)

    await restartServer2({})

    expect(await countCachedThumbnailRows(FileStorage.OBJECT_STORAGE)).to.equal(0)

    await fetchThumbnails()

    expect(await servers[1].servers.countFiles(join('cache', 'thumbnails'))).to.equal(thumbnailUrls.length)
    expect(await countCachedThumbnailRows(FileStorage.FILE_SYSTEM)).to.equal(thumbnailUrls.length)
  })

  after(async function () {
    await sqlCommand?.cleanup()
    await cleanupTests(servers)

    await objectStorage.cleanupMock()
  })
}

describe('Test lazy static endpoints', function () {
  describe('On the file system', function () {
    runSuite({ objectStorage: false })
  })

  describe('In object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runSuite({ objectStorage: true })
  })

  describe('When enabling or disabling object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runStorageSwitchSuite()
  })
})
