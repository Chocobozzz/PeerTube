import { exists } from './misc'

function isVideoTimeValid (value: number, videoDuration?: number) {
  if (value < 0) return false
  if (exists(videoDuration) && value > videoDuration) return false

  return true
}

export {
  isVideoTimeValid
}
