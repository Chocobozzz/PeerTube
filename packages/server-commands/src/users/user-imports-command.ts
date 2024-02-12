import { HttpStatusCode, HttpStatusCodeType, UserImport, UserImportUploadResult } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class UserImportsCommand extends AbstractCommand {

  importArchive (options: OverrideCommandOptions & {
    userId: number
    fixture: string
    completedExpectedStatus?: HttpStatusCodeType
  }) {
    return this.buildResumeUpload<UserImportUploadResult>({
      ...options,

      path: `/api/v1/users/${options.userId}/imports/import-resumable`,
      fixture: options.fixture,
      completedExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getLatestImport (options: OverrideCommandOptions & {
    userId: number
  }) {
    return this.getRequestBody<UserImport>({
      ...options,

      path: `/api/v1/users/${options.userId}/imports/latest`,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
