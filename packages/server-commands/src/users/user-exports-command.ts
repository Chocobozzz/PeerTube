import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ResultList, UserExport, UserExportRequestResult, UserExportState } from '@peertube/peertube-models'
import { writeFile } from 'fs/promises'
import { makeRawRequest, unwrapBody } from '../requests/requests.js'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class UserExportsCommand extends AbstractCommand {

  request (options: OverrideCommandOptions & {
    userId: number
    withVideoFiles: boolean
  }) {
    const { userId, withVideoFiles } = options

    return unwrapBody<UserExportRequestResult>(this.postBodyRequest({
      ...options,

      path: `/api/v1/users/${userId}/exports/request`,
      fields: { withVideoFiles },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    }))
  }

  async waitForCreation (options: OverrideCommandOptions & {
    userId: number
  }) {
    const { userId } = options

    while (true) {
      const { data } = await this.list({ ...options, userId })

      if (data.some(e => e.state.id === UserExportState.COMPLETED)) break

      await wait(250)
    }
  }

  list (options: OverrideCommandOptions & {
    userId: number
  }) {
    const { userId } = options

    return this.getRequestBody<ResultList<UserExport>>({
      ...options,

      path: `/api/v1/users/${userId}/exports`,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  async downloadLatestArchive (options: OverrideCommandOptions & {
    userId: number
    destination: string
  }) {
    const { data } = await this.list(options)

    const res = await makeRawRequest({
      url: data[0].privateDownloadUrl,
      responseType: 'arraybuffer',
      redirects: 1,
      expectedStatus: HttpStatusCode.OK_200
    })

    await writeFile(options.destination, res.body)
  }

  async deleteAllArchives (options: OverrideCommandOptions & {
    userId: number
  }) {
    const { data } = await this.list(options)

    for (const { id } of data) {
      await this.delete({ ...options, exportId: id })
    }
  }

  delete (options: OverrideCommandOptions & {
    exportId: number
    userId: number
  }) {
    const { userId, exportId } = options

    return this.deleteRequest({
      ...options,

      path: `/api/v1/users/${userId}/exports/${exportId}`,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

}
