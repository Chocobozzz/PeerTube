import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(
    'ALTER TABLE "plugin" ALTER COLUMN "description" TYPE VARCHAR(20000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "plugin" ALTER COLUMN "homepage" TYPE VARCHAR(2000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "runnerRegistrationToken" ALTER COLUMN "registrationToken" TYPE VARCHAR(1000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "runner" ALTER COLUMN "runnerToken" TYPE VARCHAR(1000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "runnerJob" ALTER COLUMN "processingJobToken" TYPE VARCHAR(1000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "localVideoViewer" ALTER COLUMN "url" TYPE VARCHAR(2000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "tracker" ALTER COLUMN "url" TYPE VARCHAR(2000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "uploadImage" ALTER COLUMN "fileUrl" TYPE VARCHAR(2000)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "oAuthToken" ALTER COLUMN "loginDevice" TYPE VARCHAR(500)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "oAuthToken" ALTER COLUMN "lastActivityDevice" TYPE VARCHAR(500)',
    { transaction }
  )

  await utils.sequelize.query(
    'ALTER TABLE "localVideoViewer" ALTER COLUMN "client" TYPE VARCHAR(500)',
    { transaction }
  )
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
