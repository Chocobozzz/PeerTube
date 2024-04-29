/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai'
import { mkdir } from 'node:fs/promises'
import { TranscriptFile } from '@peertube/peertube-transcription'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'

describe('Transcript File', function () {
  before(async function () {
    await mkdir(buildAbsoluteFixturePath('transcription/transcript/'), { recursive: true })
  })

  it(`may creates a new transcript file from scratch`, async function () {
    const transcript1 = await TranscriptFile.write({
      path: buildAbsoluteFixturePath('transcription/transcript/test1.txt'),
      content: 'test2',
      format: 'txt'
    })
    const transcript2 = await TranscriptFile.write({
      path: buildAbsoluteFixturePath('transcription/transcript/test2.txt'),
      content: 'test2',
      format: 'txt'
    })

    expect(await transcript1.equals(transcript2)).to.be.true
  })
})
