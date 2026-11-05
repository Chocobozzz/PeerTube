import { lookup, LookupAddress, LookupOptions } from 'dns'
import ipaddr from 'ipaddr.js'
import { isIP, LookupFunction } from 'net'

export async function isResolvingToUnicastOnly (hostname: string) {
  const addresses = await dnsLookupAll(hostname)

  return addresses.every(a => isUnicastIP(a))
}

export function isUnicastIP (address: string) {
  // process() converts IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) to IPv4, to check the range of the IPv4 address
  const parsed = ipaddr.process(address)
  if (parsed.range() !== 'unicast') return false

  // IPv4-compatible IPv6 addresses (::a.b.c.d) are deprecated but some systems still route them to the IPv4 address
  if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).parts.slice(0, 6).every(p => p === 0)) return false

  return true
}

// Hostname of a WHATWG URL: IPv6 addresses are enclosed in brackets
export function getIPFromURLHostname (hostname: string) {
  const host = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  if (isIP(host) === 0) return undefined

  return host
}

// ---------------------------------------------------------------------------

type BaseLookup = (
  hostname: string,
  options: LookupOptions & { all: true },
  callback: (err: NodeJS.ErrnoException | null, addresses: readonly LookupAddress[]) => void
) => void

/**
 * Prevent SSRF where non unicast address are filtered out
 * Checking the resolved addresses before the request is not enough (DNS rebinding, happy eyeballs)
 */
export function buildUnicastOnlyLookup (baseLookup: BaseLookup): LookupFunction {
  return (hostname, options, callback) => {
    baseLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, undefined)

      const unicastAddresses = addresses.filter(a => isUnicastIP(a.address))

      if (unicastAddresses.length === 0) {
        const error: NodeJS.ErrnoException = new Error(`${hostname} does not resolve to a unicast IP`)
        error.code = 'ENOTFOUND'

        return callback(error, undefined)
      }

      if (options.all) return callback(null, unicastAddresses.map(({ address, family }) => ({ address, family })))

      return callback(null, unicastAddresses[0].address, unicastAddresses[0].family)
    })
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function dnsLookupAll (hostname: string) {
  return new Promise<string[]>((res, rej) => {
    lookup(hostname, { family: 0, all: true }, (err, adresses) => {
      if (err) return rej(err)

      return res(adresses.map(a => a.address))
    })
  })
}
