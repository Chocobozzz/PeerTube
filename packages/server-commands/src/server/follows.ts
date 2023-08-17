import { waitJobs } from './jobs.js'
import { PeerTubeServer } from './server.js'

async function doubleFollow (server1: PeerTubeServer, server2: PeerTubeServer) {
  await Promise.all([
    server1.follows.follow({ hosts: [ server2.url ] }),
    server2.follows.follow({ hosts: [ server1.url ] })
  ])

  // Wait request propagation
  await waitJobs([ server1, server2 ])

  return true
}

// ---------------------------------------------------------------------------

export {
  doubleFollow
}
