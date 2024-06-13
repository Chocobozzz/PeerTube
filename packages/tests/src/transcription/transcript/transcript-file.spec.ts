/* eslint-disable @typescript-eslint/no-unused-expressions */
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { TranscriptFile } from '@peertube/peertube-transcription'
import { expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('Transcript File', function () {
  const transcriptFileDirectory = join(tmpdir(), 'peertube-transcription', 'transcript-file')

  before(async function () {
    await ensureDir(transcriptFileDirectory)
  })

  it(`may creates a new transcript file from scratch`, async function () {
    const transcript1 = await TranscriptFile.write({
      path: join(transcriptFileDirectory, 'test1.txt'),
      content: 'test2',
      format: 'txt'
    })
    const transcript2 = await TranscriptFile.write({
      path: join(transcriptFileDirectory, 'test2.txt'),
      content: 'test2',
      format: 'txt'
    })

    expect(await transcript1.equals(transcript2)).to.be.true
  })

  it(`may creates a txt transcript file object from a transcript without providing the format explicitly`, function () {
    TranscriptFile.fromPath(buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.srt'), 'en')
    TranscriptFile.fromPath(buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.txt'), 'en')
  })

  it(`fails when loading a file which is obviously not a transcript`, function () {
    expect(() => TranscriptFile.fromPath(buildAbsoluteFixturePath('transcription/videos/the_last_man_on_earth.mp4'), 'en'))
      .to.throw(`Couldn't guess transcript format from extension "mp4". Valid formats are: txt, vtt, srt.`)
  })

  after(async function () {
    await remove(transcriptFileDirectory)
  })
})
