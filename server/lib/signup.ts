import { IPv4, IPv6, parse, subnetMatch } from 'ipaddr.js'
import { CONFIG } from '../initializers/config'
import { UserModel } from '../models/user/user'

const isCidr = require('is-cidr')

export type SignupMode = 'direct-registration' | 'request-registration'

async function isSignupAllowed (options: {
  signupMode: SignupMode

  ip: string // For plugins
  body?: any
}): Promise<{ allowed: boolean, errorMessage?: string }> {
  const { signupMode } = options

  if (CONFIG.SIGNUP.ENABLED === false) {
    return { allowed: false }
  }

  if (signupMode === 'direct-registration' && CONFIG.SIGNUP.REQUIRES_APPROVAL === true) {
    return { allowed: false }
  }

  // No limit and signup is enabled
  if (CONFIG.SIGNUP.LIMIT === -1) {
    return { allowed: true }
  }

  const totalUsers = await UserModel.countTotal()

  return { allowed: totalUsers < CONFIG.SIGNUP.LIMIT }
}

function isSignupAllowedForCurrentIP (ip: string) {
  if (!ip) return false

  const addr = parse(ip)
  const excludeList = [ 'blacklist' ]
  let matched = ''

  // if there is a valid, non-empty whitelist, we exclude all unknown addresses too
  if (CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr(cidr)).length > 0) {
    excludeList.push('unknown')
  }

  if (addr.kind() === 'ipv4') {
    const addrV4 = IPv4.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v4(cidr))
                       .map(cidr => IPv4.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v4(cidr))
                       .map(cidr => IPv4.parseCIDR(cidr))
    }
    matched = subnetMatch(addrV4, rangeList, 'unknown')
  } else if (addr.kind() === 'ipv6') {
    const addrV6 = IPv6.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v6(cidr))
                       .map(cidr => IPv6.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v6(cidr))
                       .map(cidr => IPv6.parseCIDR(cidr))
    }
    matched = subnetMatch(addrV6, rangeList, 'unknown')
  }

  return !excludeList.includes(matched)
}

// ---------------------------------------------------------------------------

export {
  isSignupAllowed,
  isSignupAllowedForCurrentIP
}
