import { ensureDir } from 'fs-extra/esm'
import { isGithubCI } from '@peertube/peertube-node-utils'
import { PeerTubeServer, RunServerOptions } from './server.js'

export async function createSingleServer (serverNumber: number, configOverride?: object, options: RunServerOptions = {}) {
  const server = new PeerTubeServer({ serverNumber })

  await server.flushAndRun(configOverride, options)

  return server
}

export function createMultipleServers (totalServers: number, configOverride?: object, options: RunServerOptions = {}) {
  const serverPromises: Promise<PeerTubeServer>[] = []

  for (let i = 1; i <= totalServers; i++) {
    serverPromises.push(createSingleServer(i, configOverride, options))
  }

  return Promise.all(serverPromises)
}

export function killallServers (servers: PeerTubeServer[]) {
  return Promise.all(servers.filter(s => !!s).map(s => s.kill()))
}

export async function cleanupTests (servers: PeerTubeServer[]) {
  await killallServers(servers)

  if (isGithubCI()) {
    await ensureDir('artifacts')
  }

  let p: Promise<any>[] = []
  for (const server of servers) {
    if (!server) continue

    // oxlint-disable-next-line @typescript-eslint/no-floating-promises
    p = p.concat(server.servers.cleanupTests())
  }

  return Promise.all(p)
}

export function getServerImportConfig (mode: 'youtube-dl' | 'yt-dlp') {
  return {
    import: {
      videos: {
        http: {
          youtube_dl_release: {
            url: mode === 'youtube-dl'
              ? 'https://api.github.com/repos/ytdl-org/youtube-dl/releases'
              : 'https://api.github.com/repos/yt-dlp/yt-dlp/releases',

            name: mode
          }
        }
      }
    }
  }
}
