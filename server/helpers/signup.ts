import { CONFIG } from '../initializers'
import { UserModel } from '../models/account/user'
import * as ipaddr from 'ipaddr.js'
const isCidr = require('is-cidr')

async function isSignupAllowed () {
  if (CONFIG.SIGNUP.ENABLED === false) {
    return false
  }

  // No limit and signup is enabled
  if (CONFIG.SIGNUP.LIMIT === -1) {
    return true
  }

  const totalUsers = await UserModel.countTotal()

  return totalUsers < CONFIG.SIGNUP.LIMIT
}

function isSignupAllowedForCurrentIP (ip: string) {
  const addr = ipaddr.parse(ip)
  let excludeList = [ 'blacklist' ]
  let matched = ''

  // if there is a valid, non-empty whitelist, we exclude all unknown adresses too
  if (CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr(cidr)).length > 0) {
    excludeList.push('unknown')
  }

  if (addr.kind() === 'ipv4') {
    const addrV4 = ipaddr.IPv4.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v4(cidr))
                       .map(cidr => ipaddr.IPv4.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v4(cidr))
                       .map(cidr => ipaddr.IPv4.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV4, rangeList, 'unknown')
  } else if (addr.kind() === 'ipv6') {
    const addrV6 = ipaddr.IPv6.parse(ip)
    const rangeList = {
      whitelist: CONFIG.SIGNUP.FILTERS.CIDR.WHITELIST.filter(cidr => isCidr.v6(cidr))
                       .map(cidr => ipaddr.IPv6.parseCIDR(cidr)),
      blacklist: CONFIG.SIGNUP.FILTERS.CIDR.BLACKLIST.filter(cidr => isCidr.v6(cidr))
                       .map(cidr => ipaddr.IPv6.parseCIDR(cidr))
    }
    matched = ipaddr.subnetMatch(addrV6, rangeList, 'unknown')
  }

  return !excludeList.includes(matched)
}

// ---------------------------------------------------------------------------

export {
  isSignupAllowed,
  isSignupAllowedForCurrentIP
}
