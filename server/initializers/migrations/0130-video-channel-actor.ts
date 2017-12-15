import * as Sequelize from 'sequelize'
import { DataType } from 'sequelize-typescript'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  // Create actor table
  {
    const queries = [
      `
      CREATE TYPE enum_actor_type AS ENUM (
        'Group',
        'Person',
        'Application'
      )
      `,
      `
      CREATE TABLE actor (
        id integer NOT NULL,
        type enum_actor_type NOT NULL,
        uuid uuid NOT NULL,
        name character varying(255) NOT NULL,
        url character varying(2000) NOT NULL,
        "publicKey" character varying(5000),
        "privateKey" character varying(5000),
        "followersCount" integer NOT NULL,
        "followingCount" integer NOT NULL,
        "inboxUrl" character varying(2000) NOT NULL,
        "outboxUrl" character varying(2000) NOT NULL,
        "sharedInboxUrl" character varying(2000) NOT NULL,
        "followersUrl" character varying(2000) NOT NULL,
        "followingUrl" character varying(2000) NOT NULL,
        "avatarId" integer,
        "serverId" integer,
        "createdAt" timestamp with time zone NOT NULL,
        "updatedAt" timestamp with time zone NOT NULL
      );`,
      `
      CREATE SEQUENCE actor_id_seq
      AS integer
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
      `,
      `ALTER SEQUENCE actor_id_seq OWNED BY actor.id`,
      `ALTER TABLE ONLY actor ALTER COLUMN id SET DEFAULT nextval('actor_id_seq'::regclass)`,
      `ALTER TABLE ONLY actor ADD CONSTRAINT actor_pkey PRIMARY KEY (id);`,
      `CREATE UNIQUE INDEX actor_name_server_id ON actor USING btree (name, "serverId")`,
      `ALTER TABLE ONLY actor
        ADD CONSTRAINT "actor_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES avatar(id) ON UPDATE CASCADE ON DELETE CASCADE`,
      `ALTER TABLE ONLY actor
        ADD CONSTRAINT "actor_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES server(id) ON UPDATE CASCADE ON DELETE CASCADE;`
    ]

    for (const query of queries) {
      await utils.sequelize.query(query)
    }
  }

  {
    // tslint:disable:no-trailing-whitespace
    const query1 =
      `
      INSERT INTO "actor"
        (
          type, uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
        )
        SELECT 
          'Application', uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt" 
        FROM account 
        WHERE "applicationId" IS NOT NULL
        `
    await utils.sequelize.query(query1)

    const query2 =
      `
      INSERT INTO "actor"
        (
          type, uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
        )
        SELECT 
          'Person', uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt" 
        FROM account 
        WHERE "applicationId" IS NULL
        `
    await utils.sequelize.query(query2)
  }

  {
    const data = {
      type: DataType.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('account', 'actorId', data)

    const query1 = `UPDATE account SET "actorId" = (SELECT id FROM actor WHERE actor.url = account.url)`
    await utils.sequelize.query(query1)

    data.allowNull = false
    await utils.queryInterface.changeColumn('account', 'actorId', data)

    const query2 = `ALTER TABLE ONLY account
    ADD CONSTRAINT "account_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES actor(id) ON UPDATE CASCADE ON DELETE CASCADE;
  `
    await utils.sequelize.query(query2)
  }

  {
    const query = `  
    INSERT INTO actor 
    (
    type, uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl", 
    "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
    )
    SELECT 
    'Group', "videoChannel".uuid, "videoChannel".uuid, "videoChannel".url, null, null, 0, 0, "videoChannel".url || '/inbox', 
    "videoChannel".url || '/outbox', "videoChannel".url || '/inbox', "videoChannel".url || '/followers', "videoChannel".url || '/following',
     null, account."serverId", "videoChannel"."createdAt", "videoChannel"."updatedAt" 
     FROM "videoChannel" 
     INNER JOIN "account" on "videoChannel"."accountId" = "account".id
    `
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: DataType.INTEGER,
      allowNull: true,
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoChannel', 'actorId', data)

    const query1 = `UPDATE "videoChannel" SET "actorId" = (SELECT id FROM actor WHERE actor.url = "videoChannel".url)`
    await utils.sequelize.query(query1)

    data.allowNull = false
    await utils.queryInterface.changeColumn('videoChannel', 'actorId', data)

    const query2 = `
    ALTER TABLE ONLY "videoChannel"
    ADD CONSTRAINT "videoChannel_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES actor(id) ON UPDATE CASCADE ON DELETE CASCADE;
    `
    await utils.sequelize.query(query2)
  }

  {
    await utils.queryInterface.renameTable('accountFollow', 'actorFollow')
    await utils.queryInterface.renameColumn('actorFollow', 'accountId', 'actorId')
    await utils.queryInterface.renameColumn('actorFollow', 'targetAccountId', 'targetActorId')

    try {
      await utils.queryInterface.removeConstraint('actorFollow', 'AccountFollows_accountId_fkey')
      await utils.queryInterface.removeConstraint('actorFollow', 'AccountFollows_targetAccountId_fkey')
    } catch {
      await utils.queryInterface.removeConstraint('actorFollow', 'accountFollow_accountId_fkey')
      await utils.queryInterface.removeConstraint('actorFollow', 'accountFollow_targetAccountId_fkey')
    }

    const query1 = `UPDATE "actorFollow" 
      SET "actorId" = 
      (SELECT "account"."actorId" FROM account WHERE "account"."id" = "actorFollow"."actorId")`
    await utils.sequelize.query(query1)

    const query2 = `UPDATE "actorFollow" 
      SET "targetActorId" = 
      (SELECT "account"."actorId" FROM account WHERE "account"."id" = "actorFollow"."targetActorId")`

    await utils.sequelize.query(query2)
  }

  {
    await utils.queryInterface.renameColumn('videoShare', 'accountId', 'actorId')

    try {
      await utils.queryInterface.removeConstraint('videoShare', 'VideoShares_accountId_fkey')
    } catch {
      await utils.queryInterface.removeConstraint('videoShare', 'videoShare_accountId_fkey')
    }

    const query = `UPDATE "videoShare" 
      SET "actorId" = 
      (SELECT "actorId" FROM account WHERE id = "videoShare"."actorId")`
    await utils.sequelize.query(query)
  }

  {
    const columnsToDelete = [
      'uuid',
      'url',
      'publicKey',
      'privateKey',
      'followersCount',
      'followingCount',
      'inboxUrl',
      'outboxUrl',
      'sharedInboxUrl',
      'followersUrl',
      'followingUrl',
      'serverId',
      'avatarId'
    ]
    for (const columnToDelete of columnsToDelete) {
      await utils.queryInterface.removeColumn('account', columnToDelete)
    }
  }

  {
    const columnsToDelete = [
      'uuid',
      'remote',
      'url'
    ]
    for (const columnToDelete of columnsToDelete) {
      await utils.queryInterface.removeColumn('videoChannel', columnToDelete)
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
