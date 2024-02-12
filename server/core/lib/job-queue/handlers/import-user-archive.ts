import { Job } from 'bullmq'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { ImportUserArchivePayload } from '@peertube/peertube-models'
import { UserImportModel } from '@server/models/user/user-import.js'
import { UserImporter } from '@server/lib/user-import-export/user-importer.js'
import { Emailer } from '@server/lib/emailer.js'

const lTags = loggerTagsFactory('user-import')

export async function processImportUserArchive (job: Job): Promise<void> {
  const payload = job.data as ImportUserArchivePayload
  const importModel = await UserImportModel.load(payload.userImportId)

  logger.info(`Processing importing user archive ${payload.userImportId} in job ${job.id}`, lTags())

  if (!importModel) {
    logger.info(`User import ${payload.userImportId} does not exist anymore, do not create import data.`, lTags())
    return
  }

  const exporter = new UserImporter()
  await exporter.import(importModel)

  try {
    await Emailer.Instance.addUserImportSuccessJob(importModel)

    logger.info(`User import ${payload.userImportId} ended`, lTags())
  } catch (err) {
    await Emailer.Instance.addUserImportErroredJob(importModel)

    throw err
  }
}
