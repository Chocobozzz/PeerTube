import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    // 1. Add the commentCount column as nullable without a default value
    await utils.queryInterface.addColumn('video', 'commentCount', {
      type: Sequelize.INTEGER,
      allowNull: true // Initially allow nulls
    }, { transaction })
  }

  {
    // 2. Backfill the commentCount data in small batches
    const batchSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const [videos] = await utils.sequelize.query(
        `
          SELECT v.id
          FROM video v
          ORDER BY v.id
          LIMIT ${batchSize} OFFSET ${offset}
        `,
        {
          transaction,
          // Sequelize v6 defaults to SELECT type, so no need to specify QueryTypes.SELECT
        }
      )

      if (videos.length === 0) {
        hasMore = false
        break
      }

      const videoIds = videos.map((v: any) => v.id)

      // Get comment counts for this batch
      const [counts] = await utils.sequelize.query(
        `
          SELECT "videoId", COUNT(*) AS count
          FROM "videoComment"
          WHERE "videoId" IN (:videoIds)
          GROUP BY "videoId"
        `,
        {
          transaction,
          replacements: { videoIds }
        }
      )

      // Create a map of videoId to count
      const countMap = counts.reduce((map: any, item: any) => {
        map[item.videoId] = parseInt(item.count, 10)
        return map
      }, {})

      // Update videos in this batch
      const updatePromises = videoIds.map((id: number) => {
        const count = countMap[id] || 0
        return utils.sequelize.query(
          `
            UPDATE video
            SET "commentCount" = :count
            WHERE id = :id
          `,
          {
            transaction,
            replacements: { count, id }
          }
        )
      })

      await Promise.all(updatePromises)

      offset += batchSize
    }
  }

  {
    // 3. Set the default value to 0 for future inserts
    await utils.queryInterface.changeColumn('video', 'commentCount', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0
    }, { transaction })
  }

  {
    // 4. Alter the column to be NOT NULL now that data is backfilled
    await utils.queryInterface.changeColumn('video', 'commentCount', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }, { transaction })
  }

  {
    // 5. Create the index - check if we are inside a transaction
    const isInTransaction = !!transaction;
    if (isInTransaction) {
      // Create the index without 'concurrently' if in a transaction
      await utils.queryInterface.addIndex('videoComment', ['videoId'], {
        name: 'comments_video_id_idx',
        transaction
      });
    } else {
      // Create the index concurrently if no transaction
      await utils.queryInterface.addIndex('videoComment', ['videoId'], {
        concurrently: true,
        name: 'comments_video_id_idx'
      });
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
