import * as Sequelize from 'sequelize'
import { v4 as uuidv4 } from 'uuid'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  // Assert not friends

  // Create uuid column for author
  const dataAuthorUUID = {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: true
  }
  await q.addColumn('Authors', 'uuid', dataAuthorUUID)

  // Set UUID to previous authors
  {
    const authors = await utils.db.Author.findAll()
    for (const author of authors) {
      author.uuid = uuidv4()
      await author.save()
    }
  }

  dataAuthorUUID.allowNull = false
  await q.changeColumn('Authors', 'uuid', dataAuthorUUID)

  // Create one author per user that does not already exist
  const users = await utils.db.User.findAll()
  for (const user of users) {
    const author = await utils.db.Author.find({ where: { userId: user.id } })
    if (!author) {
      await utils.db.Author.create({
        name: user.username,
        podId: null, // It is our pod
        userId: user.id
      })
    }
  }

  // Create video channels table
  await utils.db.VideoChannel.sync()

  // For each author, create its default video channel
  const authors = await utils.db.Author.findAll()
  for (const author of authors) {
    await utils.db.VideoChannel.create({
      name: `Default ${author.name} channel`,
      remote: false,
      authorId: author.id
    })
  }

  // Create channelId column for videos
  const dataChannelId = {
    type: Sequelize.INTEGER,
    defaultValue: null,
    allowNull: true
  }
  await q.addColumn('Videos', 'channelId', dataChannelId)

  const query = 'SELECT "id", "authorId" FROM "Videos"'
  const options = {
    type: Sequelize.QueryTypes.SELECT
  }
  const rawVideos = await utils.sequelize.query(query, options) as any

  for (const rawVideo of rawVideos) {
    const videoChannel = await utils.db.VideoChannel.findOne({ where: { authorId: rawVideo.authorId } })

    const video = await utils.db.Video.findByPk(rawVideo.id)
    video.channelId = videoChannel.id
    await video.save()
  }

  dataChannelId.allowNull = false
  await q.changeColumn('Videos', 'channelId', dataChannelId)

  const constraintName = 'Videos_channelId_fkey'
  const queryForeignKey = 'ALTER TABLE "Videos" ' +
    ' ADD CONSTRAINT "' + constraintName + '"' +
    ' FOREIGN KEY ("channelId") REFERENCES "VideoChannels" ON UPDATE CASCADE ON DELETE CASCADE'

  await utils.sequelize.query(queryForeignKey)

  await q.removeColumn('Videos', 'authorId')
}

function down (options) {
  // update "Applications" SET "migrationVersion" = 75;
  // delete from "Authors";
  // alter table "Authors" drop column "uuid";
  // ALTER SEQUENCE "Authors_id_seq" RESTART WITH 1
  // INSERT INTO "Authors" ("name", "createdAt", "updatedAt", "userId") VALUES ('root', NOW(), NOW(), 1);
  // alter table "Videos" drop column "channelId";
  // drop table "VideoChannels";
  // alter table "Videos" add column "authorId" INTEGER DEFAULT 1;
  // alter table "Videos" ADD CONSTRAINT "coucou" FOREIGN KEY ("authorId") REFERENCES "Authors"
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
