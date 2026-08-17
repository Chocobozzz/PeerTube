import { Job } from 'bullmq'
import { createLogger } from '@server/helpers/logger.js'
import { CreateUserExportPayload } from '@peertube/peertube-models'
import { UserExportModel } from '@server/models/user/user-export.js'
import { UserExporter } from '@server/lib/user-import-export/user-exporter.js'
import { Emailer } from '@server/lib/emailer.js'

const logger = createLogger('user-export')

export async function processCreateUserExport (job: Job): Promise<void> {
  const payload = job.data as CreateUserExportPayload
  const exportModel = await UserExportModel.load(payload.userExportId)

  logger.info('Processing create user export %s in job %s.', payload.userExportId, job.id)

  if (!exportModel) {
    logger.info(`User export ${payload.userExportId} does not exist anymore, do not create user export.`)
    return
  }

  const exporter = new UserExporter()

  try {
    await exporter.export(exportModel)

    await Emailer.Instance.addUserExportCompletedOrErroredJob(exportModel)

    logger.info(`User export ${payload.userExportId} has been created`)
  } catch (err) {
    await Emailer.Instance.addUserExportCompletedOrErroredJob(exportModel)

    throw err
  }
}
