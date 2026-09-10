import { isGithubCI } from '@peertube/peertube-node-utils'
import { ensureDir } from 'fs-extra/esm'
import merge from 'lodash-es/merge.js'
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

const secondaryCounts = new WeakMap<PeerTubeServer, number>()

// Spawn an additional process with `--role=secondary`
export async function createSecondaryServer (
  primary: PeerTubeServer,
  configOverride?: object,
  options: RunServerOptions = {}
) {
  // Primary ports live in [9001, 19000[ (see PeerTubeServer.setServerNumber), so this cannot collide
  const port = primary.port + 20000

  const index = secondaryCounts.get(primary) ?? 0
  secondaryCounts.set(primary, index + 1)

  const suffix = index === 0
    ? '-secondary'
    : `-secondary-${index + 1}`

  const server = new PeerTubeServer({ url: `http://127.0.0.1:${port}` })

  server.setSecondary(primary)

  // A secondary only configures the keys that belong to its own process: everything else is published by the primary through Redis
  // Mirrors LOCAL_CONFIG_KEYS constant
  const localConfig: any = {}
  for (const key of [ 'listen', 'webserver', 'secrets', 'trust_proxy', 'database', 'redis', 'storage', 'log', 'open_telemetry' ]) {
    if (primary.configOverride?.[key] !== undefined) localConfig[key] = primary.configOverride[key]
  }

  server.storage.logsDirectory = 'logs' + suffix

  const getPathOf = (name: string) => primary.getDirectoryPath(name + suffix) + '/'

  const ownStorage = {
    storage: {
      tmp: getPathOf('tmp'),
      tmp_persistent: getPathOf('tmp-persistent'),
      bin: getPathOf('bin'),
      avatars: getPathOf('avatars'),
      web_videos: getPathOf('web-videos'),
      streaming_playlists: getPathOf('streaming-playlists'),
      original_video_files: getPathOf('original-video-files'),
      redundancy: getPathOf('redundancy'),
      logs: getPathOf('logs'),
      previews: getPathOf('previews'),
      thumbnails: getPathOf('thumbnails'),
      storyboards: getPathOf('storyboards'),
      torrents: getPathOf('torrents'),
      captions: getPathOf('captions'),
      cache: getPathOf('cache'),
      plugins: getPathOf('plugins'),
      client_overrides: getPathOf('client-overrides'),
      well_known: getPathOf('well-known'),
      uploads: getPathOf('uploads')
    }
  }

  // Do not flush: the primary owns the database and already ran the migrations
  await server.run(
    merge(localConfig, ownStorage, { listen: { port } }, configOverride),
    {
      ...options,

      peertubeArgs: [ ...(options.peertubeArgs || []), '--role=secondary' ]
    }
  )

  return server
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
