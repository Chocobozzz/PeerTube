import { buildUUID } from '@peertube/peertube-node-utils'

function generateRunnerRegistrationToken () {
  return 'ptrrt-' + buildUUID()
}

function generateRunnerToken () {
  return 'ptrt-' + buildUUID()
}

function generateRunnerJobToken () {
  return 'ptrjt-' + buildUUID()
}

export {
  generateRunnerRegistrationToken,
  generateRunnerToken,
  generateRunnerJobToken
}
