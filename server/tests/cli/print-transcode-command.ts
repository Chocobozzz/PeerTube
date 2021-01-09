/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { execCLI } from '../../../shared/extra-utils'
import { getTargetBitrate, VideoResolution } from '../../../shared/models/videos'
import { VIDEO_TRANSCODING_FPS } from '../../initializers/constants'
import { getVideoFileBitrate, getVideoFileFPS } from '@server/helpers/ffprobe-utils'

const expect = chai.expect

describe('Test create transcoding jobs', function () {
  it('Should print the correct command for each resolution', async function () {
    const fixturePath = 'server/tests/fixtures/video_short.webm'
    const fps = await getVideoFileFPS(fixturePath)
    const bitrate = await getVideoFileBitrate(fixturePath)

    for (const resolution of [
      VideoResolution.H_720P,
      VideoResolution.H_1080P
    ]) {
      const command = await execCLI(`npm run print-transcode-command -- ${fixturePath} -r ${resolution}`)
      const targetBitrate = Math.min(getTargetBitrate(resolution, fps, VIDEO_TRANSCODING_FPS), bitrate)

      expect(command).to.includes(`-y -acodec aac -vcodec libx264 -filter:v scale=w=trunc(oh*a/2)*2:h=${resolution}`)
      expect(command).to.includes('-f mp4')
      expect(command).to.includes('-movflags faststart')
      expect(command).to.includes('-b:a 256k')
      expect(command).to.includes('-r 25')
      expect(command).to.includes('-level:v 3.1')
      expect(command).to.includes('-g:v 50')
      expect(command).to.includes(`-maxrate ${targetBitrate}`)
      expect(command).to.includes(`-bufsize ${targetBitrate * 2}`)
    }
  })
})
