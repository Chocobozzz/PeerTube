import * as ipaddr from 'ipaddr.js'
import { format } from 'util'

const advertiseDoNotTrack = (_, res, next) => {
  res.setHeader('Tk', 'N')
  return next()
}

// ---------------------------------------------------------------------------

export {
  advertiseDoNotTrack
 }
