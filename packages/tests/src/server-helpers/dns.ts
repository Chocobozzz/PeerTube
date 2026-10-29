/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildUnicastOnlyLookup, isResolvingToUnicastOnly, isUnicastIP } from '@peertube/peertube-server/core/helpers/dns.js'
import { buildSSRFSafeGot } from '@peertube/peertube-server/core/helpers/requests.js'
import CacheableLookup from 'cacheable-lookup'
import { expect } from 'chai'
import { LookupAddress } from 'dns'
import got from 'got'
import { Agent, createServer, Server } from 'http'

describe('DNS helpers', function () {
  it('Should correctly check unicast IPs', async function () {
    expect(await isResolvingToUnicastOnly('cpy.re')).to.be.true
    expect(await isResolvingToUnicastOnly('framasoft.org')).to.be.true
    expect(await isResolvingToUnicastOnly('8.8.8.8')).to.be.true

    expect(await isResolvingToUnicastOnly('127.0.0.1')).to.be.false
    expect(await isResolvingToUnicastOnly('127.0.0.1.cpy.re')).to.be.false
  })

  it('Should detect non unicast IPs', async function () {
    for (const ip of [ '8.8.8.8', '2001:4860:4860::8888', '::ffff:8.8.8.8' ]) {
      expect(isUnicastIP(ip), ip).to.be.true
    }

    const nonUnicast = [
      '127.0.0.1',
      '0.0.0.0',
      '10.0.0.1',
      '169.254.169.254',
      '100.100.100.200',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      '::7f00:1', // IPv4-compatible 127.0.0.1
      '::808:808', // IPv4-compatible 8.8.8.8
      '64:ff9b::7f00:1',
      'fc00::1',
      'fe80::1'
    ]

    for (const ip of nonUnicast) {
      expect(isUnicastIP(ip), ip).to.be.false
    }
  })

  describe('Unicast only lookup', function () {
    const lookup = buildUnicastOnlyLookup((_hostname, _options, callback) => {
      callback(null, [ { address: '127.0.0.1', family: 4 }, { address: '8.8.8.8', family: 4 }, { address: '::1', family: 6 } ])
    })

    const privateLookup = buildUnicastOnlyLookup((_hostname, _options, callback) => {
      callback(null, [ { address: '127.0.0.1', family: 4 }, { address: '::1', family: 6 } ])
    })

    it('Should only return unicast addresses', async function () {
      const addresses = await new Promise<LookupAddress[]>((res, rej) => {
        lookup('example.com', { all: true }, (err, result) => err ? rej(err) : res(result as LookupAddress[]))
      })
      expect(addresses).to.deep.equal([ { address: '8.8.8.8', family: 4 } ])

      const address = await new Promise<string>((res, rej) => {
        lookup('example.com', {}, (err, result) => err ? rej(err) : res(result as string))
      })
      expect(address).to.equal('8.8.8.8')
    })

    it('Should fail if the hostname does not resolve to a unicast address', async function () {
      const error = await new Promise<NodeJS.ErrnoException>(res => privateLookup('example.com', { all: true }, err => res(err)))

      expect(error).to.exist
      expect(error.code).to.equal('ENOTFOUND')
    })
  })

  describe('SSRF safe got', function () {
    let server: Server
    let port: number
    let hits = 0

    // Simulate an attacker DNS: an unreachable public address and a loopback address
    function buildDNSCache () {
      return new CacheableLookup({
        resolver: {
          resolve4: (_hostname, _options, callback) =>
            callback(null, [ { address: '1.2.3.4', ttl: 300 }, { address: '127.0.0.1', ttl: 300 } ]),
          resolve6: (_hostname, _options, callback) => callback(null, []),
          resolveAny: (_hostname, _options, callback) => callback(null, []),
          getServers: () => [],
          setServers: () => {}
        } as any,
        lookup: false
      })
    }

    // Like PeerTube agents, don't keep alive sockets: a socket opened by a previous request would be reused without DNS lookup
    const options = {
      retry: { limit: 0 },
      timeout: { request: 3000 },
      agent: { http: new Agent({ keepAlive: false }) }
    }

    before(async function () {
      server = createServer((_req, res) => {
        hits++
        res.end('internal')
      })

      await new Promise<void>(res => server.listen(0, '127.0.0.1', res))
      port = (server.address() as any).port
    })

    beforeEach(function () {
      hits = 0
    })

    it('Should reach the loopback address with the default lookup', async function () {
      const dnsCache = buildDNSCache()

      const { body } = await got('http://attacker.example:' + port, { ...options, dnsCache })

      expect(body).to.equal('internal')
      expect(hits).to.equal(1)
    })

    it('Should not reach the loopback address with the SSRF safe lookup', async function () {
      const safeGot = buildSSRFSafeGot(got, buildDNSCache())

      const error = await getRejection(safeGot('http://attacker.example:' + port, options))

      expect(error).to.exist
      expect(hits).to.equal(0)
    })

    it('Should forbid non unicast IP hostnames', async function () {
      const safeGot = buildSSRFSafeGot(got, buildDNSCache())

      for (const host of [ '127.0.0.1', '[::1]', '[::ffff:127.0.0.1]', '[::7f00:1]', '0.0.0.0' ]) {
        const error = await getRejection(safeGot(`http://${host}:${port}`, options))

        expect(error?.message, host).to.contain('not a unicast IP')
      }

      expect(hits).to.equal(0)
    })

    after(function () {
      server.close()
    })
  })
})

async function getRejection (promise: Promise<any>): Promise<Error> {
  try {
    await promise
  } catch (err) {
    return err
  }

  return undefined
}
