/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { FFmpegImage, ffprobePromise } from '@peertube/peertube-ffmpeg'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { getPort, randomListen, terminateServer } from '@tests/shared/mock-servers/shared.js'
import { expect } from 'chai'
import express from 'express'
import { pathExists, remove } from 'fs-extra/esm'
import { mkdtemp } from 'fs/promises'
import { Server } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'

// A DASH manifest makes FFmpeg fetch the URLs it references
function buildDASHManifest (targetUrl: string) {
  return `<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static"
  mediaPresentationDuration="PT10S" minBufferTime="PT1S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="1" bandwidth="1000" codecs="avc1.42c01e" width="320" height="240">
        <BaseURL>${targetUrl}</BaseURL>
        <SegmentBase indexRange="0-100"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`
}

describe('FFmpeg remote input', function () {
  let server: Server
  let baseUrl: string
  let tmpDirectory: string

  const internalHits: string[] = []

  before(async function () {
    const app = express()

    app.get('/internal/*', (req, res) => {
      internalHits.push(req.path)

      return res.send(Buffer.alloc(200))
    })

    // Uploaded content is served with this content type (see generateStagingObjectPresignedUrl)
    app.get('/files/dash.mp4', (_req, res) => {
      return res.type('application/octet-stream').send(buildDASHManifest(baseUrl + '/internal/secret'))
    })

    app.get('/files/:filename', (req, res) => {
      return res.type('application/octet-stream').sendFile(buildAbsoluteFixturePath(req.params.filename))
    })

    server = await randomListen(app)
    baseUrl = 'http://127.0.0.1:' + getPort(server)

    tmpDirectory = await mkdtemp(join(tmpdir(), 'peertube-test-ffmpeg-'))
  })

  beforeEach(function () {
    internalHits.length = 0
  })

  it('Should probe remote video and audio files', async function () {
    this.timeout(60000)

    const filenames = [ 'video_short.mp4', 'video_short.webm', 'video_short.mkv', 'video_short.ogv', 'video_short.avi', 'video_short.ts' ]

    for (const filename of [ ...filenames, 'sample.ogg' ]) {
      const probe = await ffprobePromise(baseUrl + '/files/' + filename)

      expect(probe.streams, filename).to.have.length.above(0)
    }
  })

  it('Should not follow the URLs of a remote DASH manifest when probing it', async function () {
    this.timeout(30000)

    let error: Error

    try {
      await ffprobePromise(baseUrl + '/files/dash.mp4')
    } catch (err) {
      error = err
    }

    expect(error).to.exist
    expect(internalHits).to.have.lengthOf(0)
  })

  it('Should not follow the URLs of a remote DASH manifest when generating a thumbnail', async function () {
    this.timeout(30000)

    const output = join(tmpDirectory, 'dash.jpg')
    let error: Error

    try {
      await buildFFmpegImage().generateThumbnailFromVideo({ fromInput: baseUrl + '/files/dash.mp4', output, framesToAnalyze: 2 })
    } catch (err) {
      error = err
    }

    expect(error).to.exist
    expect(internalHits).to.have.lengthOf(0)
  })

  it('Should generate a thumbnail from a remote video file', async function () {
    this.timeout(30000)

    const output = join(tmpDirectory, 'video.jpg')

    await buildFFmpegImage().generateThumbnailFromVideo({ fromInput: baseUrl + '/files/video_short.mp4', output, framesToAnalyze: 2 })

    expect(await pathExists(output)).to.be.true
  })

  after(async function () {
    await terminateServer(server)
    await remove(tmpDirectory)
  })

  function buildFFmpegImage () {
    const noop = () => {}

    return new FFmpegImage({
      niceness: 0,
      threads: 1,
      tmpDirectory,
      logger: { info: noop, debug: noop, warn: noop, error: noop }
    })
  }
})
