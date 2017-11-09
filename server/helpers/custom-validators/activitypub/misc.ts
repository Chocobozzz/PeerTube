import { exists } from '../misc'

function isActivityPubUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  return exists(url) && validator.isURL(url, isURLOptions)
}

export {
  isActivityPubUrlValid
}
