/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  expectStartWith,
  makeRawRequest,
  MockObjectStorage,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs,
  webtorrentAdd
} from '@shared/extra-utils'
import { HttpStatusCode, VideoDetails } from '@shared/models'

const expect = chai.expect

async function checkFiles (options: {
  video: VideoDetails

  mockObjectStorage: MockObjectStorage

  playlistBucket: string
  playlistPrefix?: string
  baseMockUrl?: string

  webtorrentBucket: string
  webtorrentPrefix?: string
}) {
  const {
    mockObjectStorage,
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
      : `http://${webtorrentBucket}.${mockObjectStorage.getEndpointHost()}/`

    const prefix = webtorrentPrefix || ''
    const start = baseUrl + prefix

    expectStartWith(file.fileUrl, start)

    const res = await makeRawRequest(file.fileDownloadUrl, HttpStatusCode.FOUND_302)
    const location = res.headers['location']
    expectStartWith(location, start)

    await makeRawRequest(location, HttpStatusCode.OK_200)
  }

  const hls = video.streamingPlaylists[0]

  if (hls) {
    allFiles = allFiles.concat(hls.files)

    const baseUrl = baseMockUrl
      ? `${baseMockUrl}/${playlistBucket}/`
      : `http://${playlistBucket}.${mockObjectStorage.getEndpointHost()}/`

    const prefix = playlistPrefix || ''
    const start = baseUrl + prefix

    expectStartWith(hls.playlistUrl, start)
    expectStartWith(hls.segmentsSha256Url, start)

    await makeRawRequest(hls.playlistUrl, HttpStatusCode.OK_200)
    const resSha = await makeRawRequest(hls.segmentsSha256Url, HttpStatusCode.OK_200)
    expect(JSON.stringify(resSha.body)).to.not.throw

    for (const file of hls.files) {
      expectStartWith(file.fileUrl, start)

      const res = await makeRawRequest(file.fileDownloadUrl, HttpStatusCode.FOUND_302)
      const location = res.headers['location']
      expectStartWith(location, start)

      await makeRawRequest(location, HttpStatusCode.OK_200)
    }
  }

  for (const file of allFiles) {
    const torrent = await webtorrentAdd(file.magnetUri, true)

    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')

    const res = await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
    expect(res.body).to.have.length.above(100)
  }

  return allFiles.map(f => f.fileUrl)
}

function runTestSuite (options: {
  playlistBucket: string
  playlistPrefix?: string

  webtorrentBucket: string
  webtorrentPrefix?: string

  useMockBaseUrl?: boolean

  maxUploadPart?: string
}) {
  const mockObjectStorage = new MockObjectStorage()
  let baseMockUrl: string

  let servers: PeerTubeServer[]

  let keptUrls: string[] = []

  const uuidsToDelete: string[] = []
  let deletedUrls: string[] = []

  before(async function () {
    this.timeout(120000)

    const port = await mockObjectStorage.initialize()
    baseMockUrl = options.useMockBaseUrl ? `http://localhost:${port}` : undefined

    await mockObjectStorage.createBucket(options.playlistBucket)
    await mockObjectStorage.createBucket(options.webtorrentBucket)

    const config = {
      object_storage: {
        enabled: true,
        endpoint: 'http://' + mockObjectStorage.getEndpointHost(),
        region: mockObjectStorage.getRegion(),

        credentials: mockObjectStorage.getCrendentialsConfig(),

        max_upload_part: options.maxUploadPart || '2MB',

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
  })

  it('Should upload a video and move it to the object storage without transcoding', async function () {
    this.timeout(20000)

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1' })
    uuidsToDelete.push(uuid)

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      const files = await checkFiles({ ...options, mockObjectStorage, video, baseMockUrl })

      deletedUrls = deletedUrls.concat(files)
    }
  })

  it('Should upload a video and move it to the object storage with transcoding', async function () {
    this.timeout(40000)

    const { uuid } = await servers[1].videos.quickUpload({ name: 'video 2' })
    uuidsToDelete.push(uuid)

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuid })
      const files = await checkFiles({ ...options, mockObjectStorage, video, baseMockUrl })

      deletedUrls = deletedUrls.concat(files)
    }
  })

  it('Should correctly delete the files', async function () {
    await servers[0].videos.remove({ id: uuidsToDelete[0] })
    await servers[1].videos.remove({ id: uuidsToDelete[1] })

    await waitJobs(servers)

    for (const url of deletedUrls) {
      await makeRawRequest(url, HttpStatusCode.NOT_FOUND_404)
    }
  })

  it('Should have kept other files', async function () {
    for (const url of keptUrls) {
      await makeRawRequest(url, HttpStatusCode.OK_200)
    }
  })

  after(async function () {
    mockObjectStorage.terminate()

    await cleanupTests(servers)
  })
}

describe('Object storage', function () {

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

      playlistPrefix: 'streaming-playlists_',
      webtorrentPrefix: 'webtorrent_',

      useMockBaseUrl: true
    })
  })

  describe('Test object storage with small upload part', function () {
    runTestSuite({
      playlistBucket: 'streaming-playlists',
      webtorrentBucket: 'videos',

      maxUploadPart: '5KB'
    })
  })
})
