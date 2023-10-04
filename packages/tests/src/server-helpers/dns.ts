/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { isResolvingToUnicastOnly } from '@peertube/peertube-server/core/helpers/dns.js'

describe('DNS helpers', function () {

  it('Should correctly check unicast IPs', async function () {
    expect(await isResolvingToUnicastOnly('cpy.re')).to.be.true
    expect(await isResolvingToUnicastOnly('framasoft.org')).to.be.true
    expect(await isResolvingToUnicastOnly('8.8.8.8')).to.be.true

    expect(await isResolvingToUnicastOnly('127.0.0.1')).to.be.false
    expect(await isResolvingToUnicastOnly('127.0.0.1.cpy.re')).to.be.false
  })
})
