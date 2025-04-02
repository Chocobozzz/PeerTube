import { VideoFile } from '@peertube/peertube-models'
import { PeerTubeServer } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { readFile } from 'fs/promises'
import type { Instance as MagnetUriInstance } from 'magnet-uri'
import { basename, join } from 'path'
import type { Torrent } from 'webtorrent'
import WebTorrent from 'webtorrent'

export async function checkWebTorrentWorks (magnetUri: string, pathMatch?: RegExp) {
  let res: { webtorrent: WebTorrent.Instance, torrent: WebTorrent.Torrent }

  try {
    res = await webtorrentAdd(magnetUri)
  } catch (err) {
    console.error(err)
    res = await webtorrentAdd(magnetUri)
  }

  const webtorrent = res.webtorrent
  const torrent = res.torrent

  expect(torrent.files).to.be.an('array')
  expect(torrent.files.length).to.equal(1)
  expect(torrent.files[0].path).to.exist.and.to.not.equal('')

  if (pathMatch) {
    expect(torrent.files[0].path).match(pathMatch)
  }

  torrent.destroy()
  webtorrent.destroy()
}

export async function parseTorrentVideo (server: PeerTubeServer, file: VideoFile) {
  const torrentName = basename(file.torrentUrl)
  const torrentPath = server.servers.buildDirectory(join('torrents', torrentName))

  const data = await readFile(torrentPath)

  return (await import('parse-torrent')).default(data)
}

export async function magnetUriDecode (data: string) {
  return (await import('magnet-uri')).decode(data)
}

export async function magnetUriEncode (data: MagnetUriInstance) {
  return (await import('magnet-uri')).encode(data)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function webtorrentAdd (torrentId: string) {
  const WebTorrent = (await import('webtorrent')).default

  const webtorrent = new WebTorrent({
    natUpnp: false,
    natPmp: false,
    utp: false,
    lsd: false
  } as any)

  webtorrent.on('error', err => console.error('Error in webtorrent', err))

  return new Promise<{ torrent: Torrent, webtorrent: typeof webtorrent }>((res, rej) => {
    const timeout = setTimeout(() => {
      torrent.destroy()
      webtorrent.destroy()

      rej(new Error('Timeout to download WebTorrent file ' + torrentId))
    }, 5000)

    const torrent = webtorrent.add(torrentId, t => {
      clearTimeout(timeout)

      return res({ torrent: t, webtorrent })
    })

    torrent.on('error', err => console.error('Error in webtorrent torrent', err))
    torrent.on('warning', warn => {
      const msg = typeof warn === 'string'
        ? warn
        : warn.message

      if (msg.includes('Unsupported')) return

      console.error('Warning in webtorrent torrent', warn)
    })
  })
}
