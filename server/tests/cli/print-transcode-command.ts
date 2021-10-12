/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { getVideoFileBitrate, getVideoFileFPS } from '@server/helpers/ffprobe-utils'
import { getMaxBitrate } from '@shared/core-utils'
import { buildAbsoluteFixturePath, CLICommand } from '@shared/extra-utils'
import { VideoResolution } from '../../../shared/models/videos'

const expect = chai.expect

describe('Test print transcode jobs', function () {

  it('Should print the correct command for each resolution', async function () {
    const fixturePath = buildAbsoluteFixturePath('video_short.webm')
    const fps = await getVideoFileFPS(fixturePath)
    const bitrate = await getVideoFileBitrate(fixturePath)

    for (const resolution of [
      VideoResolution.H_720P,
      VideoResolution.H_1080P
    ]) {
      const command = await CLICommand.exec(`npm run print-transcode-command -- ${fixturePath} -r ${resolution}`)
      const targetBitrate = Math.min(getMaxBitrate({ resolution, fps, ratio: 16 / 9 }), bitrate + (bitrate * 0.3))

      expect(command).to.includes(`-vf scale=w=-2:h=${resolution}`)
      expect(command).to.includes(`-y -acodec aac -vcodec libx264`)
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
