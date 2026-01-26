/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { VideoDetails } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Update object storage URL CLI', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let server: PeerTubeServer
  let uuid: string
  const objectStorage = new ObjectStorageCommand()

  function runUpdate (from: string, to: string) {
    const env = server.cli.getEnv()
    const command = `echo y | ${env} npm run update-object-storage-url -- --from "${from}" --to "${to}"`

    return server.cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
  }

  before(async function () {
    this.timeout(360000)

    server = await createSingleServer(1, objectStorage.getDefaultMockConfig())
    await setAccessTokensToServers([ server ])

    await objectStorage.prepareDefaultMockBuckets()

    await server.config.enableMinimumTranscoding({ keepOriginal: true })

    const video = await server.videos.quickUpload({ name: 'video' })
    uuid = video.uuid

    await server.captions.add({ language: 'ar', videoId: uuid, fixture: 'subtitle-good1.vtt' })
    await server.captions.add({ language: 'zh', videoId: uuid, fixture: 'subtitle-good1.vtt' })

    await waitJobs([ server ])
  })

  it('Should update video URLs', async function () {
    this.timeout(120000)

    const check = async (options: {
      baseUrl: string
      newBaseUrl: string
      urlGetter: (video: VideoDetails) => Promise<string[]> | string[]
    }) => {
      const { baseUrl, newBaseUrl, urlGetter } = options

      const oldVideo = await server.videos.get({ id: uuid })
      const oldFileUrls = await urlGetter(oldVideo)

      for (const url of oldFileUrls) {
        expectStartWith(url, baseUrl)
      }

      await runUpdate(baseUrl, newBaseUrl)

      const newVideo = await server.videos.get({ id: uuid })

      const shouldBe = oldFileUrls.map(f => f.replace(baseUrl, newBaseUrl))
      expect(await urlGetter(newVideo)).to.have.members(shouldBe)
    }

    await check({
      baseUrl: objectStorage.getMockWebVideosBaseUrl(),
      newBaseUrl: 'https://web-video.example.com/',
      urlGetter: video => video.files.map(f => f.fileUrl)
    })

    await check({
      baseUrl: objectStorage.getMockPlaylistBaseUrl(),
      newBaseUrl: 'https://streaming-playlists.example.com/',
      urlGetter: video => {
        const hls = getHLS(video)

        return [
          ...hls.files.map(f => f.fileUrl),

          hls.playlistUrl,
          hls.segmentsSha256Url
        ]
      }
    })

    await check({
      baseUrl: objectStorage.getMockOriginalFileBaseUrl(),
      newBaseUrl: 'https://original-file.example.com/',
      urlGetter: async video => {
        const source = await server.videos.getSource({ id: video.uuid })

        return [ source.fileUrl ]
      }
    })

    await check({
      baseUrl: objectStorage.getMockCaptionFileBaseUrl(),
      newBaseUrl: 'https://captions.example.com/',
      urlGetter: async video => {
        const { data } = await server.captions.list({ videoId: video.uuid })

        return data.map(c => c.fileUrl)
      }
    })
  })

  it('Should update user export URLs', async function () {
    this.timeout(120000)

    const user = await server.users.getMyInfo()

    await server.userExports.request({ userId: user.id, withVideoFiles: false })
    await waitJobs([ server ])

    {
      const { data } = await server.userExports.list({ userId: user.id })
      expectStartWith(data[0].fileUrl, objectStorage.getMockUserExportBaseUrl())
    }

    await runUpdate(objectStorage.getMockUserExportBaseUrl(), 'https://user-export.example.com/')

    {
      const { data } = await server.userExports.list({ userId: user.id })
      expectStartWith(data[0].fileUrl, 'https://user-export.example.com/')
    }
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ server ])
  })
})
