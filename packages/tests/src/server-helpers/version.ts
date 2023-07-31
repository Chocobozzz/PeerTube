/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { compareSemVer } from '@peertube/peertube-core-utils'

describe('Version', function () {

  it('Should correctly compare two stable versions', async function () {
    expect(compareSemVer('3.4.0', '3.5.0')).to.be.below(0)
    expect(compareSemVer('3.5.0', '3.4.0')).to.be.above(0)

    expect(compareSemVer('3.4.0', '4.1.0')).to.be.below(0)
    expect(compareSemVer('4.1.0', '3.4.0')).to.be.above(0)

    expect(compareSemVer('3.4.0', '3.4.1')).to.be.below(0)
    expect(compareSemVer('3.4.1', '3.4.0')).to.be.above(0)
  })

  it('Should correctly compare two unstable version', async function () {
    expect(compareSemVer('3.4.0-alpha', '3.4.0-beta.1')).to.be.below(0)
    expect(compareSemVer('3.4.0-alpha.1', '3.4.0-beta.1')).to.be.below(0)
    expect(compareSemVer('3.4.0-beta.1', '3.4.0-beta.2')).to.be.below(0)
    expect(compareSemVer('3.4.0-beta.1', '3.5.0-alpha.1')).to.be.below(0)

    expect(compareSemVer('3.4.0-alpha.1', '3.4.0-nightly.4')).to.be.below(0)
    expect(compareSemVer('3.4.0-nightly.3', '3.4.0-nightly.4')).to.be.below(0)
    expect(compareSemVer('3.3.0-nightly.5', '3.4.0-nightly.4')).to.be.below(0)
  })

  it('Should correctly compare a stable and unstable versions', async function () {
    expect(compareSemVer('3.4.0', '3.4.1-beta.1')).to.be.below(0)
    expect(compareSemVer('3.4.0-beta.1', '3.4.0-beta.2')).to.be.below(0)
    expect(compareSemVer('3.4.0-beta.1', '3.4.0')).to.be.below(0)
    expect(compareSemVer('3.4.0-nightly.4', '3.4.0')).to.be.below(0)
  })
})
