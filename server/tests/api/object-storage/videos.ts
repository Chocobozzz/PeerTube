/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import bytes from 'bytes'
import { expect } from 'chai'
import { stat } from 'fs-extra'
import { merge } from 'lodash'
import {
  checkTmpIsEmpty,
  checkWebTorrentWorks,
  expectLogDoesNotContain,
  expectStartWith,
  generateHighBitrateVideo,
  MockObjectStorageProxy,
  SQLCommand
} from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { sha1 } from '@shared/extra-utils'
import { HttpStatusCode, VideoDetails } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  createSingleServer,
  doubleFollow,
  killallServers,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

async function checkFiles (options: {
  server: PeerTubeServer
  originServer: PeerTubeServer
  originSQLCommand: SQLCommand

  video: VideoDetails

  baseMockUrl?: string

  playlistBucket: string
  playlistPrefix?: string

  webtorrentBucket: string
  webtorrentPrefix?: string
}) {
  const {
    server,
    originServer,
    originSQLCommand,
    video,
    playlistBucket,
    webtorrentBucket,
    baseMockUrl,
    playlistPrefix,
    webtorrentPrefix
  } = options

  let allFiles = video.files

  for (const file of video.files) {
    const baseUrl = baseMockUrl
      ? `${baseMockUrl}/${webtorrentBucket}/`
      : `http://${webtorrentBucket}.${ObjectStorageCommand.getMockEndpointHost()}/`

    const prefix = webtorrentPrefix || ''
    const start = baseUrl + prefix

    expectStartWith(file.fileUrl, start)

    const res = await makeRawRequest({ url: file.fileDownloadUrl, expectedStatus: HttpStatusCode.FOUND_302 })
    const location = res.headers['location']
    expectStartWith(location, start)

    await makeRawRequest({ url: location, expectedStatus: HttpStatusCode.OK_200 })
  }

  const hls = video.streamingPlaylists[0]

  if (hls) {
    allFiles = allFiles.concat(hls.files)

    const baseUrl = baseMockUrl
      ? `${baseMockUrl}/${playlistBucket}/`
      : `http://${playlistBucket}.${ObjectStorageCommand.getMockEndpointHost()}/`

    const prefix = playlistPrefix || ''
    const start = baseUrl + prefix

    expectStartWith(hls.playlistUrl, start)
    expectStartWith(hls.segmentsSha256Url, start)

    await makeRawRequest({ url: hls.playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

    const resSha = await makeRawRequest({ url: hls.segmentsSha256Url, expectedStatus: HttpStatusCode.OK_200 })
    expect(JSON.stringify(resSha.body)).to.not.throw

    let i = 0
    for (const file of hls.files) {
      expectStartWith(file.fileUrl, start)

      const res = await makeRawRequest({ url: file.fileDownloadUrl, expectedStatus: HttpStatusCode.FOUND_302 })
      const location = res.headers['location']
      expectStartWith(location, start)

      await makeRawRequest({ url: location, expectedStatus: HttpStatusCode.OK_200 })

      if (originServer.internalServerNumber === server.internalServerNumber) {
        const infohash = sha1(`${2 + hls.playlistUrl}+V${i}`)
        const dbInfohashes = await originSQLCommand.getPlaylistInfohash(hls.id)

        expect(dbInfohashes).to.include(infohash)
      }

      i++
    }
  }

  for (const file of allFiles) {
    await checkWebTorrentWorks(file.magnetUri)

    const res = await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    expect(res.body).to.have.length.above(100)
  }

  return allFiles.map(f => f.fileUrl)
}

function runTestSuite (options: {
  fixture?: string

  maxUploadPart?: string

  playlistBucket: string
  playlistPrefix?: string

  webtorrentBucket: string
  webtorrentPrefix?: string

  useMockBaseUrl?: boolean
}) {
  const mockObjectStorageProxy = new MockObjectStorageProxy()
  const { fixture } = options
  let baseMockUrl: string

  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[]

  let keptUrls: string[] = []

  const uuidsToDelete: string[] = []
  let deletedUrls: string[] = []

  before(async function () {
    this.timeout(120000)

    const port = await mockObjectStorageProxy.initialize()
    baseMockUrl = options.useMockBaseUrl
      ? `http://127.0.0.1:${port}`
      : undefined

    await ObjectStorageCommand.createMockBucket(options.playlistBucket)
    await ObjectStorageCommand.createMockBucket(options.webtorrentBucket)

    const config = {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
        region: ObjectStorageCommand.getMockRegion(),

        credentials: ObjectStorageCommand.getMockCredentialsConfig(),

        max_upload_part: options.maxUploadPart || '5MB',

        streaming_playlists: {
          bucket_name: options.playlistBucket,
          prefix: options.playlistPrefix,
          base_url: baseMockUrl
            ? `${baseMockUrl}/${options.playlistBucket}`
            : undefined
        },

        videos: {
          bucket_name: options.webtorrentBucket,
          prefix: options.webtorrentPrefix,
          base_url: baseMockUrl
            ? `${baseMockUrl}/${options.webtorrentBucket}`
            : undefined
        }
      }
    }

    servers = await createMultipleServers(2, config)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    for (const server of servers) {
      const { uuid } = await server.videos.quickUpload({ name: 'video to keep' })
      await waitJobs(servers)

      const files = await server.videos.listFiles({ id: uuid })
      keptUrls = keptUrls.concat(files.map(f => f.fileUrl))
    }

    sqlCommands = servers.map(s => new SQLCommand(s))
  })

  it('Should upload a video and move it to the object storage without transcoding', async function () {
    this.timeout(40000)

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1', fixture })
    uuidsToDelete.push(uuid)

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      const files = await checkFiles({ ...options, server, originServer: servers[0], originSQLCommand: sqlCommands[0], video, baseMockUrl })

      deletedUrls = deletedUrls.concat(files)
    }
  })

  it('Should upload a video and move it to the object storage with transcoding', async function () {
    this.timeout(120000)

    const { uuid } = await servers[1].videos.quickUpload({ name: 'video 2', fixture })
    uuidsToDelete.push(uuid)

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      const files = await checkFiles({ ...options, server, originServer: servers[0], originSQLCommand: sqlCommands[0], video, baseMockUrl })

      deletedUrls = deletedUrls.concat(files)
    }
  })

  it('Should fetch correctly all the files', async function () {
    for (const url of deletedUrls.concat(keptUrls)) {
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
    }
  })

  it('Should correctly delete the files', async function () {
    await servers[0].videos.remove({ id: uuidsToDelete[0] })
    await servers[1].videos.remove({ id: uuidsToDelete[1] })

    await waitJobs(servers)

    for (const url of deletedUrls) {
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }
  })

  it('Should have kept other files', async function () {
    for (const url of keptUrls) {
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
    }
  })

  it('Should have an empty tmp directory', async function () {
    for (const server of servers) {
      await checkTmpIsEmpty(server)
    }
  })

  it('Should not have downloaded files from object storage', async function () {
    for (const server of servers) {
      await expectLogDoesNotContain(server, 'from object storage')
    }
  })

  after(async function () {
    await mockObjectStorageProxy.terminate()

    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
}

describe('Object storage for videos', function () {
  if (areMockObjectStorageTestsDisabled()) return

  describe('Test config', function () {
    let server: PeerTubeServer

    const baseConfig = {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
        region: ObjectStorageCommand.getMockRegion(),

        credentials: ObjectStorageCommand.getMockCredentialsConfig(),

        streaming_playlists: {
          bucket_name: ObjectStorageCommand.DEFAULT_PLAYLIST_MOCK_BUCKET
        },

        videos: {
          bucket_name: ObjectStorageCommand.DEFAULT_WEBTORRENT_MOCK_BUCKET
        }
      }
    }

    const badCredentials = {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      secret_access_key: 'aJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    }

    it('Should fail with same bucket names without prefix', function (done) {
      const config = merge({}, baseConfig, {
        object_storage: {
          streaming_playlists: {
            bucket_name: 'aaa'
          },

          videos: {
            bucket_name: 'aaa'
          }
        }
      })

      createSingleServer(1, config)
        .then(() => done(new Error('Did not throw')))
        .catch(() => done())
    })

    it('Should fail with bad credentials', async function () {
      this.timeout(60000)

      await ObjectStorageCommand.prepareDefaultMockBuckets()

      const config = merge({}, baseConfig, {
        object_storage: {
          credentials: badCredentials
        }
      })

      server = await createSingleServer(1, config)
      await setAccessTokensToServers([ server ])

      const { uuid } = await server.videos.quickUpload({ name: 'video' })

      await waitJobs([ server ], { skipDelayed: true })
      const video = await server.videos.get({ id: uuid })

      expectStartWith(video.files[0].fileUrl, server.url)

      await killallServers([ server ])
    })

    it('Should succeed with credentials from env', async function () {
      this.timeout(60000)

      await ObjectStorageCommand.prepareDefaultMockBuckets()

      const config = merge({}, baseConfig, {
        object_storage: {
          credentials: {
            access_key_id: '',
            secret_access_key: ''
          }
        }
      })

      const goodCredentials = ObjectStorageCommand.getMockCredentialsConfig()

      server = await createSingleServer(1, config, {
        env: {
          AWS_ACCESS_KEY_ID: goodCredentials.access_key_id,
          AWS_SECRET_ACCESS_KEY: goodCredentials.secret_access_key
        }
      })

      await setAccessTokensToServers([ server ])

      const { uuid } = await server.videos.quickUpload({ name: 'video' })

      await waitJobs([ server ], { skipDelayed: true })
      const video = await server.videos.get({ id: uuid })

      expectStartWith(video.files[0].fileUrl, ObjectStorageCommand.getMockWebTorrentBaseUrl())
    })

    after(async function () {
      await killallServers([ server ])
    })
  })

  describe('Test simple object storage', function () {
    runTestSuite({
      playlistBucket: 'streaming-playlists',
      webtorrentBucket: 'videos'
    })
  })

  describe('Test object storage with prefix', function () {
    runTestSuite({
      playlistBucket: 'mybucket',
      webtorrentBucket: 'mybucket',

      playlistPrefix: 'streaming-playlists_',
      webtorrentPrefix: 'webtorrent_'
    })
  })

  describe('Test object storage with prefix and base URL', function () {
    runTestSuite({
      playlistBucket: 'mybucket',
      webtorrentBucket: 'mybucket',

      playlistPrefix: 'streaming-playlists/',
      webtorrentPrefix: 'webtorrent/',

      useMockBaseUrl: true
    })
  })

  describe('Test object storage with file bigger than upload part', function () {
    let fixture: string
    const maxUploadPart = '5MB'

    before(async function () {
      this.timeout(120000)

      fixture = await generateHighBitrateVideo()

      const { size } = await stat(fixture)

      if (bytes.parse(maxUploadPart) > size) {
        throw Error(`Fixture file is too small (${size}) to make sense for this test.`)
      }
    })

    runTestSuite({
      maxUploadPart,
      playlistBucket: 'streaming-playlists',
      webtorrentBucket: 'videos',
      fixture
    })
  })
})
