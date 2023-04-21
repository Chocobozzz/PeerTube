import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    const query = `
    CREATE TABLE IF NOT EXISTS "runnerRegistrationToken"(
      "id" serial,
      "registrationToken" varchar(255) NOT NULL,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }

  {
    const query = `
    CREATE TABLE IF NOT EXISTS "runner"(
      "id" serial,
      "runnerToken" varchar(255) NOT NULL,
      "name" varchar(255) NOT NULL,
      "description" varchar(1000),
      "lastContact" timestamp with time zone NOT NULL,
      "ip" varchar(255) NOT NULL,
      "runnerRegistrationTokenId" integer REFERENCES "runnerRegistrationToken"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }

  {
    const query = `
    CREATE TABLE IF NOT EXISTS "runnerJob"(
      "id" serial,
      "uuid" uuid NOT NULL,
      "type" varchar(255) NOT NULL,
      "payload" jsonb NOT NULL,
      "privatePayload" jsonb NOT NULL,
      "state" integer NOT NULL,
      "failures" integer NOT NULL DEFAULT 0,
      "error" varchar(5000),
      "priority" integer NOT NULL,
      "processingJobToken" varchar(255),
      "progress" integer,
      "startedAt" timestamp with time zone,
      "finishedAt" timestamp with time zone,
      "dependsOnRunnerJobId" integer REFERENCES "runnerJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "runnerId" integer REFERENCES "runner"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      "createdAt" timestamp with time zone NOT NULL,
      "updatedAt" timestamp with time zone NOT NULL,
      PRIMARY KEY ("id")
    );


    `

    await utils.sequelize.query(query, { transaction : utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
