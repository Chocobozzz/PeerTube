import ipaddr from 'ipaddr.js'
import { CONFIG } from '../initializers/config.js'
import { UserModel } from '../models/user/user.js'

export type SignupMode = 'direct-registration' | 'request-registration'

export async function isSignupAllowed (options: {
  signupMode: SignupMode

  ip: string // For plugins
  body?: any
}): Promise<{ allowed: boolean, errorMessage?: string }> {
  const { signupMode } = options

  if (CONFIG.SIGNUP.ENABLED === false) {
    return { allowed: false, errorMessage: 'User registration is not allowed' }
  }

  if (signupMode === 'direct-registration' && CONFIG.SIGNUP.REQUIRES_APPROVAL === true) {
    return { allowed: false, errorMessage: 'User registration requires approval' }
  }

  // No limit and signup is enabled
  if (CONFIG.SIGNUP.LIMIT === -1) {
    return { allowed: true }
  }

  const totalUsers = await UserModel.countTotal()

  return { allowed: totalUsers < CONFIG.SIGNUP.LIMIT, errorMessage: 'User limit is reached on this instance' }
}

export function isSignupAllowedForCurrentIP (ip: string) {
  if (!ip) return false

  const addr = ipaddr.parse(ip)
  const excludeList = [ 'blacklist' ]
  let matched = ''

  // if there is a valid, non-empty whitelist, we exclude all unknown addresses too
  if (CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.some(cidr => isIPV4Cidr(cidr) || isIPV6Cidr(cidr))) {
    excludeList.push('unknown')
  }

  if (addr.kind() === 'ipv4') {
    const addrV4 = ipaddr.IPv4.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isIPV4Cidr(cidr))
                       .map(cidr => ipaddr.IPv4.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isIPV4Cidr(cidr))
                       .map(cidr => ipaddr.IPv4.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV4, rangeList, 'unknown')
  } else if (addr.kind() === 'ipv6') {
    const addrV6 = ipaddr.IPv6.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isIPV6Cidr(cidr))
                       .map(cidr => ipaddr.IPv6.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isIPV6Cidr(cidr))
                       .map(cidr => ipaddr.IPv6.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV6, rangeList, 'unknown')
  }

  return !excludeList.includes(matched)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isIPV4Cidr (cidr: string) {
  try {
    ipaddr.IPv4.parseCIDR(cidr)
    return true
  } catch {
    return false
  }
}

function isIPV6Cidr (cidr: string) {
  try {
    ipaddr.IPv6.parseCIDR(cidr)
    return true
  } catch {
    return false
  }
}
