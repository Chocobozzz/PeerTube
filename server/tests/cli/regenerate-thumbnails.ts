import 'mocha'
import { expect } from 'chai'
import { writeFile } from 'fs-extra'
import { basename, join } from 'path'
import { Video, VideoDetails } from '@shared/models'
import {
  buildServerDirectory,
  cleanupTests,
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  getEnvCli,
  getVideo,
  makeRawRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideoAndGetId,
  waitJobs
} from '../../../shared/extra-utils'
import { HttpStatusCode } from '@shared/core-utils'

async function testThumbnail (server: ServerInfo, videoId: number | string) {
  const res = await getVideo(server.url, videoId)
  const video: VideoDetails = res.body

  const res1 = await makeRawRequest(join(server.url, video.thumbnailPath), HttpStatusCode.OK_200)
  expect(res1.body).to.not.have.lengthOf(0)

  const res2 = await makeRawRequest(join(server.url, video.thumbnailPath), HttpStatusCode.OK_200)
  expect(res2.body).to.not.have.lengthOf(0)
}

describe('Test regenerate thumbnails script', function () {
  let servers: ServerInfo[]

  let video1: Video
  let video2: Video
  let remoteVideo: Video

  let thumbnail1Path: string
  let thumbnailRemotePath: string

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    {
      const videoUUID1 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 1' })).uuid
      video1 = await (getVideo(servers[0].url, videoUUID1).then(res => res.body))

      thumbnail1Path = join(buildServerDirectory(servers[0], 'thumbnails'), basename(video1.thumbnailPath))

      const videoUUID2 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video 2' })).uuid
      video2 = await (getVideo(servers[0].url, videoUUID2).then(res => res.body))
    }

    {
      const videoUUID = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video 3' })).uuid
      await waitJobs(servers)

      remoteVideo = await (getVideo(servers[0].url, videoUUID).then(res => res.body))

      thumbnailRemotePath = join(buildServerDirectory(servers[0], 'thumbnails'), basename(remoteVideo.thumbnailPath))
    }

    await writeFile(thumbnail1Path, '')
    await writeFile(thumbnailRemotePath, '')
  })

  it('Should have empty thumbnails', async function () {
    {
      const res = await makeRawRequest(join(servers[0].url, video1.thumbnailPath), HttpStatusCode.OK_200)
      expect(res.body).to.have.lengthOf(0)
    }

    {
      const res = await makeRawRequest(join(servers[0].url, video2.thumbnailPath), HttpStatusCode.OK_200)
      expect(res.body).to.not.have.lengthOf(0)
    }

    {
      const res = await makeRawRequest(join(servers[0].url, remoteVideo.thumbnailPath), HttpStatusCode.OK_200)
      expect(res.body).to.have.lengthOf(0)
    }
  })

  it('Should regenerate local thumbnails from the CLI', async function () {
    this.timeout(15000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run regenerate-thumbnails`)
  })

  it('Should have generated new thumbnail files', async function () {
    await testThumbnail(servers[0], video1.uuid)
    await testThumbnail(servers[0], video2.uuid)

    const res = await makeRawRequest(join(servers[0].url, remoteVideo.thumbnailPath), HttpStatusCode.OK_200)
    expect(res.body).to.have.lengthOf(0)
  })

  it('Should have deleted old thumbnail files', async function () {
    {
      await makeRawRequest(join(servers[0].url, video1.thumbnailPath), HttpStatusCode.NOT_FOUND_404)
    }

    {
      await makeRawRequest(join(servers[0].url, video2.thumbnailPath), HttpStatusCode.NOT_FOUND_404)
    }

    {
      const res = await makeRawRequest(join(servers[0].url, remoteVideo.thumbnailPath), HttpStatusCode.OK_200)
      expect(res.body).to.have.lengthOf(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
