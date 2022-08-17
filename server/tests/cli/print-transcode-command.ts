/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { buildAbsoluteFixturePath } from '@shared/core-utils'
import { CLICommand } from '@shared/server-commands'
import { VideoResolution } from '../../../shared/models/videos'

describe('Test print transcode jobs', function () {

  it('Should print the correct command for each resolution', async function () {
    const fixturePath = buildAbsoluteFixturePath('video_short.webm')

    for (const resolution of [
      VideoResolution.H_720P,
      VideoResolution.H_1080P
    ]) {
      const command = await CLICommand.exec(`npm run print-transcode-command -- ${fixturePath} -r ${resolution}`)

      expect(command).to.includes(`-vf scale=w=-2:h=${resolution}`)
      expect(command).to.includes(`-y -acodec aac -vcodec libx264`)
      expect(command).to.includes('-f mp4')
      expect(command).to.includes('-movflags faststart')
      expect(command).to.includes('-b:a 256k')
      expect(command).to.includes('-r 25')
      expect(command).to.includes('-level:v 3.1')
      expect(command).to.includes('-g:v 50')
      expect(command).to.includes(`-maxrate:v `)
      expect(command).to.includes(`-bufsize:v `)
    }
  })
})
