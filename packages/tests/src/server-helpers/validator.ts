/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  isPluginStableOrUnstableVersionValid,
  isPluginStableVersionValid
} from '@peertube/peertube-server/core/helpers/custom-validators/plugins.js'

describe('Validators', function () {

  it('Should correctly check stable plugin versions', async function () {
    expect(isPluginStableVersionValid('3.4.0')).to.be.true
    expect(isPluginStableVersionValid('0.4.0')).to.be.true
    expect(isPluginStableVersionValid('0.1.0')).to.be.true

    expect(isPluginStableVersionValid('0.1.0-beta-1')).to.be.false
    expect(isPluginStableVersionValid('hello')).to.be.false
    expect(isPluginStableVersionValid('0.x.a')).to.be.false
  })

  it('Should correctly check unstable plugin versions', async function () {
    expect(isPluginStableOrUnstableVersionValid('3.4.0')).to.be.true
    expect(isPluginStableOrUnstableVersionValid('0.4.0')).to.be.true
    expect(isPluginStableOrUnstableVersionValid('0.1.0')).to.be.true

    expect(isPluginStableOrUnstableVersionValid('0.1.0-beta.1')).to.be.true
    expect(isPluginStableOrUnstableVersionValid('0.1.0-alpha.45')).to.be.true
    expect(isPluginStableOrUnstableVersionValid('0.1.0-rc.45')).to.be.true

    expect(isPluginStableOrUnstableVersionValid('hello')).to.be.false
    expect(isPluginStableOrUnstableVersionValid('0.x.a')).to.be.false
    expect(isPluginStableOrUnstableVersionValid('0.1.0-rc-45')).to.be.false
    expect(isPluginStableOrUnstableVersionValid('0.1.0-rc.45d')).to.be.false
  })
})
