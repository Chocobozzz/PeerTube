import { millisecondsToTime, millisecondsToVttTime, secondsToTime } from '@peertube/peertube-core-utils'
import { expect } from 'chai'

describe('Seconds to time', function () {
  it('Outputs a human readable time', function () {
    expect(secondsToTime(61.1335)).to.equals('1m1s')
  })

  it('Rounds the number of seconds to the nearest integer', function () {
    expect(secondsToTime(61.4)).to.equals('1m1s')
    expect(secondsToTime(61.6)).to.equals('1m2s')
    expect(secondsToTime(61.51)).to.equals('1m2s')
  })
})

describe('Milliseconds to time', function () {
  it('Outputs a human readable time', function () {
    expect(millisecondsToTime(60_000)).to.equals('1m')
  })

  it('Rounds the number of seconds to the nearest integer', function () {
    expect(millisecondsToTime(60_100)).to.equals('1m')
    expect(millisecondsToTime(60_501)).to.equals('1m1s')
  })

  it('Time inferior to 500ms appears as empty string', function () {
    expect(millisecondsToTime(499)).to.equals('')
  })
})

describe('Milliseconds to WebVTT time', function () {

  it('Should have a valid WebVTT time', function () {
    expect(millisecondsToVttTime(1000)).to.equal('00:00:01.000')
    expect(millisecondsToVttTime(1001)).to.equal('00:00:01.001')
    expect(millisecondsToVttTime(3600_000 * 4 + (60_000 * 45))).to.equal('04:45:00.000')
  })
})
