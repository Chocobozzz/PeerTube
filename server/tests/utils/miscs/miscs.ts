import * as WebTorrent from 'webtorrent'
import { readFile, readdir } from 'fs'

let webtorrent = new WebTorrent()

function immutableAssign <T, U> (target: T, source: U) {
  return Object.assign<{}, T, U>({}, target, source)
}

function readFilePromise (path: string) {
  return new Promise<Buffer>((res, rej) => {
    readFile(path, (err, data) => {
      if (err) return rej(err)

      return res(data)
    })
  })
}

function readdirPromise (path: string) {
  return new Promise<string[]>((res, rej) => {
    readdir(path, (err, files) => {
      if (err) return rej(err)

      return res(files)
    })
  })
}

  // Default interval -> 5 minutes
function dateIsValid (dateString: string, interval = 300000) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval
}

function wait (milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

// ---------------------------------------------------------------------------

export {
  readFilePromise,
  readdirPromise,
  dateIsValid,
  wait,
  webtorrentAdd,
  immutableAssign
}
