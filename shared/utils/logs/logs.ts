// Thanks: https://stackoverflow.com/a/37014317
import { stat } from 'fs-extra'
import { makeGetRequest } from '../requests/requests'
import { LogLevel } from '../../models/server/log-level.type'

async function mtimeSortFilesDesc (files: string[], basePath: string) {
  const promises = []
  const out: { file: string, mtime: number }[] = []

  for (const file of files) {
    const p = stat(basePath + '/' + file)
      .then(stats => {
        if (stats.isFile()) out.push({ file, mtime: stats.mtime.getTime() })
      })

    promises.push(p)
  }

  await Promise.all(promises)

  out.sort((a, b) => b.mtime - a.mtime)

  return out
}

function getLogs (url: string, accessToken: string, startDate: Date, endDate?: Date, level?: LogLevel) {
  const path = '/api/v1/server/logs'

  return makeGetRequest({
    url,
    path,
    token: accessToken,
    query: { startDate, endDate, level },
    statusCodeExpected: 200
  })
}

export {
  mtimeSortFilesDesc,
  getLogs
}
