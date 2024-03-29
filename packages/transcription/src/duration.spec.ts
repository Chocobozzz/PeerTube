import { expect } from 'chai'
import { toHumanReadable, toTimecode } from './duration.js'

describe('duration conversion functions', () => {
  it('toHumanReadable', () => {
    const ONE_MINUTE = 60000
    let humanDuration = toHumanReadable(ONE_MINUTE)
    expect(humanDuration).to.equal('1m')

    humanDuration = toHumanReadable(ONE_MINUTE * 60 + ONE_MINUTE)
    expect(humanDuration).to.equal('1h 1m')
  })

  it('toTimecode', () => {
    const MORE_OR_LESS_ONE_MINUTE = '60.41545'
    let timecode = toTimecode(MORE_OR_LESS_ONE_MINUTE)
    expect(timecode).to.equal('00:01:00')

    const ONE_HOUR = '3600'
    timecode = toTimecode(ONE_HOUR)
    expect(timecode).to.equal('01:00:00')
  })
})
