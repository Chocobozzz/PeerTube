/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import snakeCase from 'lodash-es/snakeCase.js'
import validator from 'validator'
import {
  buildAspectRatio,
  getAverageTheoreticalBitrate,
  getMaxTheoreticalBitrate,
  parseChapters,
  timeToInt
} from '@peertube/peertube-core-utils'
import { VideoResolution } from '@peertube/peertube-models'
import { objectConverter, parseBytes, parseDurationToMs, parseSemVersion } from '@peertube/peertube-server/core/helpers/core-utils.js'

describe('Parse Bytes', function () {

  it('Should pass on valid value', function () {
    // just return it
    expect(parseBytes(-1024)).to.equal(-1024)
    expect(parseBytes(1024)).to.equal(1024)
    expect(parseBytes(1048576)).to.equal(1048576)
    expect(parseBytes('1024')).to.equal(1024)
    expect(parseBytes('1048576')).to.equal(1048576)

    // sizes
    expect(parseBytes('1B')).to.equal(1024)
    expect(parseBytes('1MB')).to.equal(1048576)
    expect(parseBytes('1GB')).to.equal(1073741824)
    expect(parseBytes('1TB')).to.equal(1099511627776)

    expect(parseBytes('5GB')).to.equal(5368709120)
    expect(parseBytes('5TB')).to.equal(5497558138880)

    expect(parseBytes('1024B')).to.equal(1048576)
    expect(parseBytes('1024MB')).to.equal(1073741824)
    expect(parseBytes('1024GB')).to.equal(1099511627776)
    expect(parseBytes('1024TB')).to.equal(1125899906842624)

    // with whitespace
    expect(parseBytes('1 GB')).to.equal(1073741824)
    expect(parseBytes('1\tGB')).to.equal(1073741824)

    // sum value
    expect(parseBytes('1TB 1024MB')).to.equal(1100585369600)
    expect(parseBytes('4GB 1024MB')).to.equal(5368709120)
    expect(parseBytes('4TB 1024GB')).to.equal(5497558138880)
    expect(parseBytes('4TB 1024GB 0MB')).to.equal(5497558138880)
    expect(parseBytes('1024TB 1024GB 1024MB')).to.equal(1127000492212224)
  })

  it('Should be invalid when given invalid value', function () {
    expect(parseBytes('6GB 1GB')).to.equal(6)
  })
})

describe('Parse duration', function () {

  it('Should pass when given valid value', function () {
    expect(parseDurationToMs(35)).to.equal(35)
    expect(parseDurationToMs(-35)).to.equal(-35)
    expect(parseDurationToMs('35 seconds')).to.equal(35 * 1000)
    expect(parseDurationToMs('1 minute')).to.equal(60 * 1000)
    expect(parseDurationToMs('1 hour')).to.equal(3600 * 1000)
    expect(parseDurationToMs('35 hours')).to.equal(3600 * 35 * 1000)
  })

  it('Should be invalid when given invalid value', function () {
    expect(parseBytes('35m 5s')).to.equal(35)
  })
})

describe('Time to int', function () {

  it('Should correctly parse time to int', function () {
    expect(timeToInt(undefined)).to.equal(0)
    expect(timeToInt('')).to.equal(0)

    expect(timeToInt('1h02')).to.equal(3602)

    expect(timeToInt('1:02')).to.equal(62)
    expect(timeToInt('01:2')).to.equal(62)

    expect(timeToInt('02h02m03s')).to.equal(7323)
    expect(timeToInt('2:02:3')).to.equal(7323)

    expect(timeToInt('5h10m')).to.equal(5 * 3600 + 60 * 10)
    expect(timeToInt('5h10m0s')).to.equal(5 * 3600 + 60 * 10)
    expect(timeToInt('5h10m0')).to.equal(5 * 3600 + 60 * 10)

    expect(timeToInt(3500)).to.equal(3500)
  })
})

describe('Object', function () {

  it('Should convert an object', function () {
    function keyConverter (k: string) {
      return snakeCase(k)
    }

    function valueConverter (v: any) {
      if (validator.default.isNumeric(v + '')) return parseInt('' + v, 10)

      return v
    }

    const obj = {
      mySuperKey: 'hello',
      mySuper2Key: '45',
      mySuper3Key: {
        mySuperSubKey: '15',
        mySuperSub2Key: 'hello',
        mySuperSub3Key: [ '1', 'hello', 2 ],
        mySuperSub4Key: 4
      },
      mySuper4Key: 45,
      toto: {
        super_key: '15',
        superKey2: 'hello'
      },
      super_key: {
        superKey4: 15
      }
    }

    const res = objectConverter(obj, keyConverter, valueConverter)

    expect(res.my_super_key).to.equal('hello')
    expect(res.my_super_2_key).to.equal(45)
    expect(res.my_super_3_key.my_super_sub_key).to.equal(15)
    expect(res.my_super_3_key.my_super_sub_2_key).to.equal('hello')
    expect(res.my_super_3_key.my_super_sub_3_key).to.deep.equal([ 1, 'hello', 2 ])
    expect(res.my_super_3_key.my_super_sub_4_key).to.equal(4)
    expect(res.toto.super_key).to.equal(15)
    expect(res.toto.super_key_2).to.equal('hello')
    expect(res.super_key.super_key_4).to.equal(15)

    // Immutable
    expect(res.mySuperKey).to.be.undefined
    expect(obj['my_super_key']).to.be.undefined
  })
})

describe('Bitrate', function () {

  it('Should get appropriate max bitrate', function () {
    const tests = [
      { resolution: VideoResolution.H_144P, ratio: 16 / 9, fps: 24, min: 200, max: 400 },
      { resolution: VideoResolution.H_240P, ratio: 16 / 9, fps: 24, min: 600, max: 800 },
      { resolution: VideoResolution.H_360P, ratio: 16 / 9, fps: 24, min: 1200, max: 1600 },
      { resolution: VideoResolution.H_480P, ratio: 16 / 9, fps: 24, min: 2000, max: 2300 },
      { resolution: VideoResolution.H_720P, ratio: 16 / 9, fps: 24, min: 4000, max: 4400 },
      { resolution: VideoResolution.H_1080P, ratio: 16 / 9, fps: 24, min: 8000, max: 10000 },
      { resolution: VideoResolution.H_4K, ratio: 16 / 9, fps: 24, min: 25000, max: 30000 }
    ]

    for (const test of tests) {
      expect(getMaxTheoreticalBitrate(test)).to.be.above(test.min * 1000).and.below(test.max * 1000)
    }
  })

  it('Should get appropriate average bitrate', function () {
    const tests = [
      { resolution: VideoResolution.H_144P, ratio: 16 / 9, fps: 24, min: 50, max: 300 },
      { resolution: VideoResolution.H_240P, ratio: 16 / 9, fps: 24, min: 350, max: 450 },
      { resolution: VideoResolution.H_360P, ratio: 16 / 9, fps: 24, min: 700, max: 900 },
      { resolution: VideoResolution.H_480P, ratio: 16 / 9, fps: 24, min: 1100, max: 1300 },
      { resolution: VideoResolution.H_720P, ratio: 16 / 9, fps: 24, min: 2300, max: 2500 },
      { resolution: VideoResolution.H_1080P, ratio: 16 / 9, fps: 24, min: 4700, max: 5000 },
      { resolution: VideoResolution.H_4K, ratio: 16 / 9, fps: 24, min: 15000, max: 17000 }
    ]

    for (const test of tests) {
      expect(getAverageTheoreticalBitrate(test)).to.be.above(test.min * 1000).and.below(test.max * 1000)
    }
  })

  describe('Ratio', function () {

    it('Should have the correct aspect ratio in landscape', function () {
      expect(buildAspectRatio({ width: 1920, height: 1080 })).to.equal(1.7778)
      expect(buildAspectRatio({ width: 1000, height: 1000 })).to.equal(1)
    })

    it('Should have the correct aspect ratio in portrait', function () {
      expect(buildAspectRatio({ width: 1080, height: 1920 })).to.equal(0.5625)
    })
  })
})

describe('Parse semantic version string', function () {

  it('Should parse Node.js version string', function () {
    const actual = parseSemVersion('v18.16.0')

    expect(actual.major).to.equal(18)
    expect(actual.minor).to.equal(16)
    expect(actual.patch).to.equal(0)
  })

  it('Should parse FFmpeg version string from Debian 12 repo', function () {
    const actual = parseSemVersion('5.1.3-1')

    expect(actual.major).to.equal(5)
    expect(actual.minor).to.equal(1)
    expect(actual.patch).to.equal(3)
  })

  it('Should parse FFmpeg version string from Arch repo', function () {
    const actual = parseSemVersion('n6.0')

    expect(actual.major).to.equal(6)
    expect(actual.minor).to.equal(0)
    expect(actual.patch).to.equal(0)
  })

  it('Should parse FFmpeg version from GitHub release', function () {
    const actual = parseSemVersion('5.1.3')

    expect(actual.major).to.equal(5)
    expect(actual.minor).to.equal(1)
    expect(actual.patch).to.equal(3)
  })

  it('Should parse FFmpeg version from GitHub dev release', function () {
    const actual = parseSemVersion('5.1.git')

    expect(actual.major).to.equal(5)
    expect(actual.minor).to.equal(1)
    expect(actual.patch).to.equal(0)
  })

  it('Should parse FFmpeg version string with missing patch segment', function () {
    const actual = parseSemVersion('4.4')

    expect(actual.major).to.equal(4)
    expect(actual.minor).to.equal(4)
    expect(actual.patch).to.equal(0)
  })
})

describe('Extract chapters', function () {

  it('Should not extract chapters', function () {
    expect(parseChapters('my super description\nno?', 100)).to.deep.equal([])
    expect(parseChapters('m00:00 super description\nno?', 100)).to.deep.equal([])
    expect(parseChapters('00:00super description\nno?', 100)).to.deep.equal([])
    expect(parseChapters('my super description\n'.repeat(10) + ' * list1\n * list 2\n * list 3', 100)).to.deep.equal([])
    expect(parseChapters('3 Hello coucou', 100)).to.deep.equal([])
    expect(parseChapters('00:00 coucou', 100)).to.deep.equal([])
  })

  it('Should extract chapters', function () {
    expect(parseChapters('00:00 coucou\n00:05 hello', 100)).to.deep.equal([
      { timecode: 0, title: 'coucou' },
      { timecode: 5, title: 'hello' }
    ])

    expect(parseChapters('my super description\n\n00:01:30 chapter 1\n00:01:35 chapter 2', 100)).to.deep.equal([
      { timecode: 90, title: 'chapter 1' },
      { timecode: 95, title: 'chapter 2' }
    ])
    expect(parseChapters('hi\n\n00:01:30 chapter 1\n00:01:35 chapter 2\nhi', 100)).to.deep.equal([
      { timecode: 90, title: 'chapter 1' },
      { timecode: 95, title: 'chapter 2' }
    ])
    expect(parseChapters('hi\n\n00:01:30 chapter 1\n00:01:35 chapter 2\nhi\n00:01:40 chapter 3', 100)).to.deep.equal([
      { timecode: 90, title: 'chapter 1' },
      { timecode: 95, title: 'chapter 2' }
    ])
  })

  it('Should respect the max length option', function () {
    expect(parseChapters('my super description\n\n00:01:30 chapter 1\n00:01:35 chapter 2', 3)).to.deep.equal([
      { timecode: 90, title: 'cha' },
      { timecode: 95, title: 'cha' }
    ])
  })
})
