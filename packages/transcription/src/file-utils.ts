import { basename, extname } from 'path'

export const getFileInfo = (path: string) => {
  const extension = extname(path)
  const baseName = basename(path, extension)
  const name = `${baseName}${extension}`

  return ({
    extension,
    baseName,
    name
  })
}
