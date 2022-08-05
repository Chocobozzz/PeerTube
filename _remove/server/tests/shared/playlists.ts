import { expect } from 'chai'
import { readdir } from 'fs-extra'
import { join } from 'path'
import { root } from '@shared/core-utils'

async function checkPlaylistFilesWereRemoved (
  playlistUUID: string,
  internalServerNumber: number,
  directories = [ 'thumbnails' ]
) {
  const testDirectory = 'test' + internalServerNumber

  for (const directory of directories) {
    const directoryPath = join(root(), testDirectory, directory)

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(playlistUUID)
    }
  }
}

export {
  checkPlaylistFilesWereRemoved
}
