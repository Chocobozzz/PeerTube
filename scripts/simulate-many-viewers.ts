import { wait } from '@peertube/peertube-core-utils'
import {
  createSingleServer,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { isMainThread } from 'worker_threads'
import Piscina from 'piscina'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const THOUSAND_VIEWERS = 2
const TOTAL_THREADS = 20

let servers: PeerTubeServer[]
const viewers: { xForwardedFor: string }[] = []
let videoId: string
let pool: Piscina

if (isMainThread) {
  run()
    .then(() => process.exit(0))
    .catch(err => console.error(err))
    .finally(() => killallServers(servers))
}

// ---------------------------------------------------------------------------

async function run () {
  await prepare()

  while (true) {
    await runViewers()
  }
}

async function prepare () {
  pool = new Piscina({
    filename: join(dirname(fileURLToPath(import.meta.url)), 'simulate-many-viewers-worker.js'),
    minThreads: 20,
    maxThreads: 20
  })

  console.log('Preparing servers...')

  const config = {
    log: {
      level: 'info',
      log_http_requests: false
    },
    rates_limit: {
      api: {
        max: 5_000_000
      }
    },
    views: {
      videos: {
        local_buffer_update_interval: '30 minutes',
        view_expiration: '1 hour'
      }
    }
  }

  const env = { PRODUCTION_CONSTANTS: 'true' }

  servers = await Promise.all([
    createSingleServer(1, config, { env, nodeArgs: [ '--inspect' ] }),
    createSingleServer(2, config, { env }),
    createSingleServer(3, config, { env })
  ])

  await setAccessTokensToServers(servers)
  await doubleFollow(servers[0], servers[1])
  await doubleFollow(servers[0], servers[2])

  const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
  videoId = uuid

  await waitJobs(servers)

  for (let i = 2; i < 252; i++) {
    for (let j = 2; j < 6; j++) {
      for (let k = 2; k < THOUSAND_VIEWERS + 2; k++) {
        viewers.push({ xForwardedFor: `0.${k}.${j}.${i},127.0.0.1` })
      }
    }
  }

  console.log('Servers preparation finished.')
}

async function runViewers () {
  console.log('Will run views of %d viewers.', viewers.length)

  const before = new Date().getTime()

  const promises: Promise<any>[] = []

  for (let i = 0; i < TOTAL_THREADS; i++) {
    const start = i * THOUSAND_VIEWERS * 1000 / TOTAL_THREADS
    const end = (i + 1) * THOUSAND_VIEWERS * 1000 / TOTAL_THREADS

    console.log(`Sending viewers ${start} to ${end}`)

    promises.push(pool.run({ url: servers[0].url, viewers: viewers.slice(start, end), videoId }))
  }

  await Promise.all(promises)

  console.log('Finished to run views in %d seconds.', (new Date().getTime() - before) / 1000)

  await wait(5000)
}
