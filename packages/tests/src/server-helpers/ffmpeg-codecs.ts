import { getAudioStreamCodec } from '@peertube/peertube-server/core/helpers/ffmpeg/codecs.js'
import { expect } from 'chai'
import { FfprobeData } from 'fluent-ffmpeg'

function buildProbe (audioCodecName?: string) {
  const streams = audioCodecName
    ? [ { codec_type: 'audio', codec_name: audioCodecName } ]
    : []

  return { streams, format: { filename: 'fake.mp4' } } as unknown as FfprobeData
}

describe('FFmpeg codecs', function () {
  describe('HLS audio codec', function () {
    it('Should get the codec of known audio codecs', async function () {
      const expected = {
        aac: 'mp4a.40.2',
        mp3: 'mp4a.40.34',
        opus: 'opus',
        vorbis: 'vorbis',
        flac: 'fLaC',
        ac3: 'ac-3',
        eac3: 'ec-3'
      }

      for (const [ codecName, hlsCodec ] of Object.entries(expected)) {
        expect(await getAudioStreamCodec('fake.mp4', buildProbe(codecName))).to.equal(hlsCodec)
      }
    })

    it('Should not declare an unknown audio codec', async function () {
      expect(await getAudioStreamCodec('fake.mp4', buildProbe('pcm_s16le'))).to.equal('')
    })

    it('Should not declare an audio codec without audio stream', async function () {
      expect(await getAudioStreamCodec('fake.mp4', buildProbe())).to.equal('')
    })
  })
})
