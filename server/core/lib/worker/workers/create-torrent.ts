import createTorrent, { CreateTorrentOptions } from 'create-torrent'

export default function createTorrentPromise (options: CreateTorrentOptions & { path: string }): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    createTorrent(options.path, options, (err, torrent) => {
      if (err) return reject(err)

      resolve(torrent)
    })
  })
}
