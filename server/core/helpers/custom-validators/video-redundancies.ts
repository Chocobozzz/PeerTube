import { exists } from './misc.js'

function isVideoRedundancyTarget (value: any) {
  return exists(value) &&
    (value === 'my-videos' || value === 'remote-videos')
}

// ---------------------------------------------------------------------------

export {
  isVideoRedundancyTarget
}
