import { exists } from './misc'

function checkVideoRedundancyTarget (value: any) {
  if (!exists(value)) throw new Error('Should have a video redundancy target')
  if (![ 'my-videos', 'remote-videos' ].includes(value)) throw new Error('Should have a known video redundancy target')
  return true
}

// ---------------------------------------------------------------------------

export {
  checkVideoRedundancyTarget
}
