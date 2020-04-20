import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {

  const deletedVideo = {
    type: Sequelize.JSONB,
    allowNull: true
  }
  await utils.queryInterface.addColumn('videoAbuse', 'deletedVideo', deletedVideo)
  await utils.sequelize.query(`ALTER TABLE "videoAbuse" ALTER COLUMN "videoId" DROP NOT NULL;`)
  await utils.sequelize.query(`ALTER TABLE "videoAbuse" DROP CONSTRAINT IF EXISTS "videoAbuse_videoId_fkey";`)

}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
