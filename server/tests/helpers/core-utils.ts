/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { snakeCase } from 'lodash'
import validator from 'validator'
import { getAverageTheoreticalBitrate, getMaxTheoreticalBitrate } from '@shared/core-utils'
import { VideoResolution } from '@shared/models'
import { objectConverter, parseBytes, parseDurationToMs } from '../../helpers/core-utils'

describe('Parse Bytes', function () {

  it('Should pass on valid value', async function () {
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

  it('Should be invalid when given invalid value', async function () {
    expect(parseBytes('6GB 1GB')).to.equal(6)
  })
})

describe('Parse duration', function () {

  it('Should pass when given valid value', async function () {
    expect(parseDurationToMs(35)).to.equal(35)
    expect(parseDurationToMs(-35)).to.equal(-35)
    expect(parseDurationToMs('35 seconds')).to.equal(35 * 1000)
    expect(parseDurationToMs('1 minute')).to.equal(60 * 1000)
    expect(parseDurationToMs('1 hour')).to.equal(3600 * 1000)
    expect(parseDurationToMs('35 hours')).to.equal(3600 * 35 * 1000)
  })

  it('Should be invalid when given invalid value', async function () {
    expect(parseBytes('35m 5s')).to.equal(35)
  })
})

describe('Object', function () {

  it('Should convert an object', async function () {
    function keyConverter (k: string) {
      return snakeCase(k)
    }

    function valueConverter (v: any) {
      if (validator.isNumeric(v + '')) return parseInt('' + v, 10)

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
})
