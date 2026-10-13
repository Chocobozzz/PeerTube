import { sha256 } from '@peertube/peertube-node-utils'
import { CONFIG } from '../../initializers/config.js'
import { CONTACT_FORM_LIFETIME } from '../../initializers/constants.js'
import { keyExists, setValue } from './redis-client.js'

export function setContactFormIp (ip: string) {
  return setValue(generateContactFormKey(ip), '1', CONTACT_FORM_LIFETIME)
}

export function doesContactFormIpExist (ip: string) {
  return keyExists(generateContactFormKey(ip))
}

// ---------------------------------------------------------------------------

function generateContactFormKey (ip: string) {
  return 'contact-form-' + sha256(CONFIG.SECRETS.PEERTUBE + '-' + ip)
}
