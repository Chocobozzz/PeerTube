import { Server as HTTPServer } from 'node:http'
import { createLogger } from '../helpers/logger.js'
import { SHUTDOWN_TIMEOUTS } from '../initializers/constants.js'
import { sequelizeTypescript } from '../initializers/database.js'
import { JobQueue } from './job-queue/job-queue.js'
import { LiveManager } from './live/live-manager.js'
import { Redis } from './redis/index.js'
import { AbstractScheduler } from './schedulers/abstract-scheduler.js'

const logger = createLogger()

let shuttingDown = false

/**
 * A signal that has no listener keeps its default disposition, and the kernel never delivers such a signal to the init process
 * of a PID namespace. PeerTube is PID 1 in our docker image, so without an explicit listener SIGTERM is silently discarded and
 * the container is SIGKILLed after the runtime grace period. So always listen to the signals we want to handle.
 */
export function registerGracefulShutdown (server: HTTPServer) {
  for (const signal of [ 'SIGINT', 'SIGTERM' ] as const) {
    process.on(signal, () => {
      if (shuttingDown === true) {
        logger.info(`Received a second ${signal} signal, exiting now.`)

        return process.exit(0)
      }

      shuttingDown = true
      logger.info(`Received ${signal}, gracefully shutting down PeerTube.`)

      shutdown(server)
        .catch(err => logger.error('Error in graceful shutdown.', { err }))
        .finally(() => process.exit(0))
    })
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function shutdown (server: HTTPServer) {
  const timeout = setTimeout(() => {
    logger.warn(`Graceful shutdown did not complete in ${SHUTDOWN_TIMEOUTS.GLOBAL}ms, exiting now.`)

    process.exit(0)
  }, SHUTDOWN_TIMEOUTS.GLOBAL)
  timeout.unref()

  // Stop scheduling new work first, so nothing can grab a database connection we are about to close
  AbstractScheduler.disableAll()
  LiveManager.Instance.stop()

  await Promise.all([
    closeHTTPServer(server),

    // Active jobs are not awaited: a transcoding job can run for hours. They are retried when detected as stalled
    JobQueue.Instance.terminate({ force: true })
      .catch(err => logger.error('Cannot terminate job queue.', { err }))
  ])

  await Promise.all([
    sequelizeTypescript.close()
      .catch(err => logger.error('Cannot close database connection.', { err })),

    Redis.Instance.quit()
      .catch(err => logger.error('Cannot close redis connection.', { err }))
  ])

  clearTimeout(timeout)

  logger.info('PeerTube gracefully shut down.')
}

function closeHTTPServer (server: HTTPServer) {
  return new Promise<void>(res => {
    server.close(err => {
      if (err) logger.error('Cannot close HTTP server.', { err })

      res()
    })

    // server.close() only stops accepting new connections: also close the idle keep alive/websocket ones
    server.closeIdleConnections()

    // And then destroy the remaining ones so a long running request cannot delay the shutdown
    setTimeout(() => server.closeAllConnections(), SHUTDOWN_TIMEOUTS.HTTP_CONNECTIONS).unref()
  })
}
