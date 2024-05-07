import { millisecondsToTime, secondsToTime } from '@peertube/peertube-core-utils'
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
