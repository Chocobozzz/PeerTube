import * as Sequelize from 'sequelize'
import { createPrivateAndPublicKeys } from '../../helpers/peertube-crypto'
import { shareVideoByServerAndChannel } from '../../lib/activitypub/share'
import { getVideoActivityPubUrl, getVideoChannelActivityPubUrl } from '../../lib/activitypub/url'
import { createLocalAccountWithoutKeys } from '../../lib/user'
import { ApplicationModel } from '../../models/application/application'
import { SERVER_ACTOR_NAME } from '../constants'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface
  const db = utils.db

  // Assert there are no friends
  {
    const query = 'SELECT COUNT(*) as total FROM "Pods"'
    const options = {
      type: Sequelize.QueryTypes.SELECT
    }
    const res = await utils.sequelize.query(query, options) as any

    if (!res[0] || res[0].total !== 0) {
      throw new Error('You need to quit friends.')
    }
  }

  // Pods -> Servers
  await utils.queryInterface.renameTable('Pods', 'Servers')

  // Create Account table
  await db.Account.sync()

  // Create AccountFollows table
  await db.AccountFollow.sync()

  // Modify video abuse table
  await db.VideoAbuse.destroy({ truncate: true })
  await utils.queryInterface.removeColumn('VideoAbuses', 'reporterPodId')
  await utils.queryInterface.removeColumn('VideoAbuses', 'reporterUsername')

  // Create column link with Account table
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Accounts',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }
    await q.addColumn('VideoAbuses', 'reporterAccountId', data)
  }

  // Drop request tables
  await utils.queryInterface.dropTable('RequestToPods')
  await utils.queryInterface.dropTable('RequestVideoEvents')
  await utils.queryInterface.dropTable('RequestVideoQadus')
  await utils.queryInterface.dropTable('Requests')

  // Create application account
  {
    const applicationInstance = await ApplicationModel.findOne()
    const accountCreated = await createLocalAccountWithoutKeys({
      name: SERVER_ACTOR_NAME,
      userId: null,
      applicationId: applicationInstance.id,
      t: undefined
    })

    const { publicKey, privateKey } = await createPrivateAndPublicKeys()
    accountCreated.Actor.publicKey = publicKey
    accountCreated.Actor.privateKey = privateKey

    await accountCreated.save()
  }

  // Drop old video channel foreign key (referencing Authors)
  {
    const query = 'ALTER TABLE "VideoChannels" DROP CONSTRAINT "VideoChannels_authorId_fkey"'
    await utils.sequelize.query(query)
  }

  // Recreate accounts for each user
  const users = await db.User.findAll()
  for (const user of users) {
    const account = await createLocalAccountWithoutKeys({ name: user.username, userId: user.id, applicationId: null, t: undefined })

    const { publicKey, privateKey } = await createPrivateAndPublicKeys()
    account.Actor.publicKey = publicKey
    account.Actor.privateKey = privateKey
    await account.save()
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      onDelete: 'CASCADE',
      reference: {
        model: 'Account',
        key: 'id'
      }
    }
    await q.addColumn('VideoChannels', 'accountId', data)

    {
      const query = 'UPDATE "VideoChannels" SET "accountId" = ' +
                    '(SELECT "Accounts"."id" FROM "Accounts" INNER JOIN "Authors" ON "Authors"."userId" = "Accounts"."userId" ' +
                    'WHERE "VideoChannels"."authorId" = "Authors"."id")'
      await utils.sequelize.query(query)
    }

    data.allowNull = false
    await q.changeColumn('VideoChannels', 'accountId', data)

    await q.removeColumn('VideoChannels', 'authorId')
  }

  // Add url column to "Videos"
  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }
    await q.addColumn('Videos', 'url', data)

    const videos = await db.Video.findAll()
    for (const video of videos) {
      video.url = getVideoActivityPubUrl(video)
      await video.save()
    }

    data.allowNull = false
    await q.changeColumn('Videos', 'url', data)
  }

  // Add url column to "VideoChannels"
  {
    const data = {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }
    await q.addColumn('VideoChannels', 'url', data)

    const videoChannels = await db.VideoChannel.findAll()
    for (const videoChannel of videoChannels) {
      videoChannel.url = getVideoChannelActivityPubUrl(videoChannel)
      await videoChannel.save()
    }

    data.allowNull = false
    await q.changeColumn('VideoChannels', 'url', data)
  }

  // Loss old video rates, whatever
  await utils.queryInterface.dropTable('UserVideoRates')
  await db.AccountVideoRate.sync()

  {
    const data = {
      type: Sequelize.ENUM('transcoding', 'activitypub-http'),
      defaultValue: 'transcoding',
      allowNull: false
    }
    await q.addColumn('Jobs', 'category', data)
  }

  await db.VideoShare.sync()
  await db.VideoChannelShare.sync()

  {
    const videos = await db.Video.findAll({
      include: [
        {
          model: db.Video['sequelize'].models.VideoChannel,
          include: [
            {
              model: db.Video['sequelize'].models.Account,
              include: [ { model: db.Video['sequelize'].models.Server, required: false } ]
            }
          ]
        },
        {
          model: db.Video['sequelize'].models.AccountVideoRate,
          include: [ db.Video['sequelize'].models.Account ]
        },
        {
          model: db.Video['sequelize'].models.VideoShare,
          include: [ db.Video['sequelize'].models.Account ]
        },
        db.Video['sequelize'].models.Tag,
        db.Video['sequelize'].models.VideoFile
      ]
    })

    for (const video of videos) {
      await shareVideoByServerAndChannel(video, undefined)
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
