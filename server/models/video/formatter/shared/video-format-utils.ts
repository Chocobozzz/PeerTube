import { MVideoFile } from '@server/types/models'

export function sortByResolutionDesc (fileA: MVideoFile, fileB: MVideoFile) {
  if (fileA.resolution < fileB.resolution) return 1
  if (fileA.resolution === fileB.resolution) return 0
  return -1
}
