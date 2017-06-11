/*
  Different from 'utils' because we don't not import other PeerTube modules.
  Useful to avoid circular dependencies.
*/

import { join } from 'path'

function isTestInstance () {
  return process.env.NODE_ENV === 'test'
}

function root () {
  // We are in /dist/helpers/utils.js
  return join(__dirname, '..', '..', '..')
}

// ---------------------------------------------------------------------------

export {
  isTestInstance,
  root
}
