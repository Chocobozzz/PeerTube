/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { isStableOrUnstableVersionValid, isStableVersionValid } from '@peertube/peertube-server/core/helpers/custom-validators/misc.js'
import {} from '@peertube/peertube-server/core/helpers/custom-validators/plugins.js'
import { expect } from 'chai'

describe('Validators', function () {
  it('Should correctly check stable plugin versions', async function () {
    expect(isStableVersionValid('3.4.0')).to.be.true
    expect(isStableVersionValid('0.4.0')).to.be.true
    expect(isStableVersionValid('0.1.0')).to.be.true

    expect(isStableVersionValid('0.1.0-beta-1')).to.be.false
    expect(isStableVersionValid('hello')).to.be.false
    expect(isStableVersionValid('0.x.a')).to.be.false
  })

  it('Should correctly check unstable plugin versions', async function () {
    expect(isStableOrUnstableVersionValid('3.4.0')).to.be.true
    expect(isStableOrUnstableVersionValid('0.4.0')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0')).to.be.true

    expect(isStableOrUnstableVersionValid('0.1.0-beta.1')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0-alpha.45')).to.be.true
    expect(isStableOrUnstableVersionValid('0.1.0-rc.45')).to.be.true

    expect(isStableOrUnstableVersionValid('hello')).to.be.false
    expect(isStableOrUnstableVersionValid('0.x.a')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-rc-45')).to.be.false
    expect(isStableOrUnstableVersionValid('0.1.0-rc.45d')).to.be.false
  })
})
