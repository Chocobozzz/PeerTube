import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `CREATE TABLE IF NOT EXISTS "automaticTag" ("id"   SERIAL , "name" VARCHAR(255) NOT NULL, PRIMARY KEY ("id"));`

    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
CREATE TABLE IF NOT EXISTS "videoAutomaticTag"(
  "videoId" integer REFERENCES "video"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "automaticTagId" integer NOT NULL REFERENCES "automaticTag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" integer REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" timestamp with time zone NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("videoId", "automaticTagId", "accountId")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
CREATE TABLE IF NOT EXISTS "commentAutomaticTag"(
  "commentId" integer REFERENCES "videoComment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "automaticTagId" integer NOT NULL REFERENCES "automaticTag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" integer REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" timestamp with time zone NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("commentId", "automaticTagId", "accountId")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
CREATE TABLE IF NOT EXISTS "watchedWordsList"(
  "id" serial,
  "listName" varchar(255) NOT NULL,
  "words" varchar(255)[] NOT NULL,
  "accountId" integer NOT NULL REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" timestamp with time zone NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    const query = `
CREATE TABLE IF NOT EXISTS "accountAutomaticTagPolicy"(
  "id" serial,
  "policy" integer,
  "accountId" integer NOT NULL REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "automaticTagId" integer NOT NULL REFERENCES "automaticTag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" timestamp with time zone NOT NULL,
  "updatedAt" timestamp with time zone NOT NULL,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  {
    await utils.queryInterface.addColumn('video', 'commentsPolicy', {
      type: Sequelize.INTEGER,
      defaultValue: 1, // ENABLED
      allowNull: false
    }, { transaction })

    const query = `UPDATE "video" SET "commentsPolicy" = 2 WHERE "commentsEnabled" IS FALSE` // Disabled
    await utils.sequelize.query(query, { transaction })

    await utils.queryInterface.changeColumn('video', 'commentsPolicy', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.removeColumn('video', 'commentsEnabled', { transaction })
  }

  {
    await utils.queryInterface.addColumn('videoComment', 'heldForReview', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }, { transaction })

    await utils.queryInterface.changeColumn('videoComment', 'heldForReview', {
      type: Sequelize.BOOLEAN,
      defaultValue: null,
      allowNull: false
    }, { transaction })
  }

  {
    await utils.queryInterface.addColumn('videoComment', 'replyApproval', {
      type: Sequelize.STRING,
      defaultValue: null,
      allowNull: true
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
