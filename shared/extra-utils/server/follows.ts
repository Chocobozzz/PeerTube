import { waitJobs } from './jobs'
import { ServerInfo } from './servers'

async function doubleFollow (server1: ServerInfo, server2: ServerInfo) {
  await Promise.all([
    server1.follows.follow({ targets: [ server2.url ] }),
    server2.follows.follow({ targets: [ server1.url ] })
  ])

  // Wait request propagation
  await waitJobs([ server1, server2 ])

  return true
}

// ---------------------------------------------------------------------------

export {
  doubleFollow
}
