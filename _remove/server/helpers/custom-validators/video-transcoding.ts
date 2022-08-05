import { exists } from './misc'

function isValidCreateTranscodingType (value: any) {
  return exists(value) &&
    (value === 'hls' || value === 'webtorrent')
}

// ---------------------------------------------------------------------------

export {
  isValidCreateTranscodingType
}
