import { minBy, wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, Thumbnail, Video } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { writeFile } from 'fs/promises'
import { basename, join } from 'path'

async function testCurrentThumbnail (server: PeerTubeServer, videoId: number | string) {
  const video = await server.videos.get({ id: videoId })

  for (const thumbnail of video.thumbnails) {
    const { body } = await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    expect(body).to.not.have.lengthOf(0)
  }
}

describe('Test regenerate thumbnails CLI', function () {
  let servers: PeerTubeServer[]

  let video1: Video
  let video2: Video
  let remoteVideo: Video

  let localSmallestThumbnailPath: string
  let remoteSmallestThumbnailPath: string

  function isTruncatedThumbnail (thumbnail: Thumbnail) {
    return basename(thumbnail.fileUrl) === basename(localSmallestThumbnailPath) ||
      basename(thumbnail.fileUrl) === basename(remoteSmallestThumbnailPath)
  }

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    {
      const videoUUID1 = (await servers[0].videos.quickUpload({ name: 'video 1' })).uuid
      video1 = await servers[0].videos.get({ id: videoUUID1 })

      const smallestThumbnail = minBy(video1.thumbnails, 'width')
      localSmallestThumbnailPath = join(join(servers[0].servers.buildDirectory('thumbnails'), basename(smallestThumbnail.fileUrl)))

      const videoUUID2 = (await servers[0].videos.quickUpload({ name: 'video 2' })).uuid
      video2 = await servers[0].videos.get({ id: videoUUID2 })
    }

    {
      const videoUUID = (await servers[1].videos.quickUpload({ name: 'video 3' })).uuid
      await waitJobs(servers)

      remoteVideo = await servers[0].videos.get({ id: videoUUID })

      // Load remote thumbnails on disk
      for (const thumbnail of remoteVideo.thumbnails) {
        await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      const smallestThumbnail = minBy(remoteVideo.thumbnails, 'width')
      remoteSmallestThumbnailPath = join(
        servers[0].servers.buildDirectory(join('cache', 'thumbnails')),
        basename(smallestThumbnail.fileUrl)
      )
    }

    await writeFile(localSmallestThumbnailPath, '')
    await writeFile(remoteSmallestThumbnailPath, '')
  })

  it('Should have empty thumbnails', async function () {
    for (const thumbnail of [ ...video1.thumbnails, ...remoteVideo.thumbnails ]) {
      const { body } = await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })

      if (isTruncatedThumbnail(thumbnail)) {
        expect(body).to.have.lengthOf(0)
      } else {
        expect(body).to.not.have.lengthOf(0)
      }
    }

    for (const thumbnail of video2.thumbnails) {
      const { body } = await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(body).to.not.have.lengthOf(0)
    }
  })

  it('Should regenerate local thumbnails from the CLI', async function () {
    await servers[0].cli.execWithEnv(`npm run regenerate-thumbnails`)
  })

  it('Should have generated new thumbnail files', async function () {
    await testCurrentThumbnail(servers[0], video1.uuid)
    await testCurrentThumbnail(servers[0], video2.uuid)
  })

  it('Should have deleted old local thumbnail files', async function () {
    for (const thumbnail of [ ...video1.thumbnails, ...video2.thumbnails ]) {
      await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }
  })

  it('Should regenerate remote thumbnails', async function () {
    await servers[1].cli.execWithEnv(`npm run regenerate-thumbnails`)
  })

  it('Should still have cached remote thumbnails on server 1', async function () {
    for (const thumbnail of remoteVideo.thumbnails) {
      const { body } = await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })

      if (isTruncatedThumbnail(thumbnail)) {
        expect(body).to.have.lengthOf(0)
      } else {
        expect(body).to.not.have.lengthOf(0)
      }
    }
  })

  it('Should refresh the video and remove previous cached thumbnails', async function () {
    await wait(10000)

    await servers[0].videos.get({ id: remoteVideo.uuid }) // Refresh remote video thumbnails
    await waitJobs(servers)

    for (const thumbnail of remoteVideo.thumbnails) {
      await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }
  })

  it('Should have the appropriate thumbnails count', async function () {
    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(4)
    expect(await servers[0].servers.countFiles('cache/thumbnails')).to.equal(0)
  })

  it('Should re-cache thumbnails on server 1', async function () {
    const remoteVideoRefreshed = await servers[0].videos.get({ id: remoteVideo.uuid })

    for (const thumbnail of remoteVideoRefreshed.thumbnails) {
      await makeRawRequest({ url: thumbnail.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    expect(await servers[0].servers.countFiles('thumbnails')).to.equal(4)
    expect(await servers[0].servers.countFiles('cache/thumbnails')).to.equal(2)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
