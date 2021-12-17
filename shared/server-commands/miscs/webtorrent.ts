import { readFile } from 'fs-extra'
import parseTorrent from 'parse-torrent'
import { basename, join } from 'path'
import * as WebTorrent from 'webtorrent'
import { VideoFile } from '@shared/models'
import { PeerTubeServer } from '../server'

let webtorrent: WebTorrent.Instance

function webtorrentAdd (torrentId: string, refreshWebTorrent = false) {
  const WebTorrent = require('webtorrent')

  if (webtorrent && refreshWebTorrent) webtorrent.destroy()
  if (!webtorrent || refreshWebTorrent) webtorrent = new WebTorrent()

  webtorrent.on('error', err => console.error('Error in webtorrent', err))

  return new Promise<WebTorrent.Torrent>(res => {
    const torrent = webtorrent.add(torrentId, res)

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

async function parseTorrentVideo (server: PeerTubeServer, file: VideoFile) {
  const torrentName = basename(file.torrentUrl)
  const torrentPath = server.servers.buildDirectory(join('torrents', torrentName))

  const data = await readFile(torrentPath)

  return parseTorrent(data)
}

export {
  webtorrentAdd,
  parseTorrentVideo
}
