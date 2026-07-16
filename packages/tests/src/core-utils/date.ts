/* oxlint-disable @typescript-eslint/no-unused-expressions */

import {
  isLastMonth,
  isLastWeek,
  isThisMonth,
  isThisWeek,
  isToday,
  isYesterday,
  millisecondsToTime,
  millisecondsToVttTime,
  secondsToTime,
  timeToInt
} from '@peertube/peertube-core-utils'
import { expect } from 'chai'

describe('Is today', function () {
  it('Returns true for the current date', function () {
    expect(isToday(new Date())).to.be.true
  })

  it('Returns false for yesterday', function () {
    const d = new Date()
    d.setDate(d.getDate() - 1)

    expect(isToday(d)).to.be.false
  })
})

describe('Is yesterday', function () {
  it('Returns true for yesterday', function () {
    const d = new Date()
    d.setDate(d.getDate() - 1)

    expect(isYesterday(d)).to.be.true
  })

  it('Returns false for today', function () {
    expect(isYesterday(new Date())).to.be.false
  })
})

describe('Is this week', function () {
  it('Returns true for today', function () {
    expect(isThisWeek(new Date())).to.be.true
  })

  it('Returns false for 8 days ago', function () {
    const d = new Date()
    d.setDate(d.getDate() - 8)

    expect(isThisWeek(d)).to.be.false
  })

  it('Returns true for the very start of today, ignoring milliseconds', function () {
    const d = new Date()
    d.setHours(0, 0, 0, 0)

    expect(isThisWeek(d)).to.be.true
  })
})

describe('Is this month', function () {
  it('Returns true for the current date', function () {
    expect(isThisMonth(new Date())).to.be.true
  })

  it('Returns false for the same month last year', function () {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)

    expect(isThisMonth(d)).to.be.false
  })

  it('Returns false for last month', function () {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)

    expect(isThisMonth(d)).to.be.false
  })
})

describe('Is last month', function () {
  it('Returns true for 15 days ago', function () {
    const d = new Date()
    d.setDate(d.getDate() - 15)

    expect(isLastMonth(d)).to.be.true
  })

  it('Returns false for 40 days ago', function () {
    const d = new Date()
    d.setDate(d.getDate() - 40)

    expect(isLastMonth(d)).to.be.false
  })
})

describe('Is last week', function () {
  it('Returns true for 3 days ago', function () {
    const d = new Date()
    d.setDate(d.getDate() - 3)

    expect(isLastWeek(d)).to.be.true
  })

  it('Returns false for 10 days ago', function () {
    const d = new Date()
    d.setDate(d.getDate() - 10)

    expect(isLastWeek(d)).to.be.false
  })
})

describe('Time to int', function () {
  it('Returns 0 for falsy input', function () {
    expect(timeToInt(0)).to.equal(0)
    expect(timeToInt('')).to.equal(0)
  })

  it('Floors a number input', function () {
    expect(timeToInt(61.9)).to.equal(61)
  })

  it('Parses the 00h00m00s format', function () {
    expect(timeToInt('1h1m1s')).to.equal(3661)
    expect(timeToInt('1h')).to.equal(3600)
    expect(timeToInt('90s')).to.equal(90)
  })

  it('Parses the colon-separated format', function () {
    expect(timeToInt('20')).to.equal(20)
    expect(timeToInt('05:20')).to.equal(320)
    expect(timeToInt('01:02:03')).to.equal(3723)
  })

  it('Returns 0 instead of NaN for more than 3 colon-separated parts', function () {
    expect(timeToInt('1:02:03:04')).to.equal(0)
  })

  it('Returns 0 for an invalid string', function () {
    expect(timeToInt('abc')).to.equal(0)
  })
})

describe('Seconds to time', function () {
  it('Outputs a human readable time', function () {
    expect(secondsToTime(61.1335)).to.equals('1m1s')
  })

  it('Rounds the number of seconds to the nearest integer', function () {
    expect(secondsToTime(61.4)).to.equals('1m1s')
    expect(secondsToTime(61.6)).to.equals('1m2s')
    expect(secondsToTime(61.51)).to.equals('1m2s')
  })

  it('Carries the rounding into minutes/hours when crossing a boundary', function () {
    expect(secondsToTime(59.6)).to.equals('1m')
    expect(secondsToTime(3599.6)).to.equals('1h')
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
