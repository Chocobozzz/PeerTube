"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_typescript_1 = require("sequelize-typescript");
const peertube_crypto_1 = require("../../helpers/peertube-crypto");
function up(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        {
            const queries = [
                `DROP TYPE IF EXISTS enum_actor_type`,
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
        "preferredUsername" character varying(255) NOT NULL,
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
                `CREATE SEQUENCE actor_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1`,
                `ALTER SEQUENCE actor_id_seq OWNED BY actor.id`,
                `ALTER TABLE ONLY actor ALTER COLUMN id SET DEFAULT nextval('actor_id_seq'::regclass)`,
                `ALTER TABLE ONLY actor ADD CONSTRAINT actor_pkey PRIMARY KEY (id);`,
                `CREATE UNIQUE INDEX actor_preferred_username_server_id ON actor USING btree ("preferredUsername", "serverId")`,
                `ALTER TABLE ONLY actor
        ADD CONSTRAINT "actor_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES avatar(id) ON UPDATE CASCADE ON DELETE CASCADE`,
                `ALTER TABLE ONLY actor
        ADD CONSTRAINT "actor_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES server(id) ON UPDATE CASCADE ON DELETE CASCADE;`
            ];
            for (const query of queries) {
                yield utils.sequelize.query(query);
            }
        }
        {
            const query1 = `
      INSERT INTO "actor"
        (
          type, uuid, "preferredUsername", url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
        )
        SELECT 
          'Application', uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt" 
        FROM account 
        WHERE "applicationId" IS NOT NULL
        `;
            yield utils.sequelize.query(query1);
            const query2 = `
      INSERT INTO "actor"
        (
          type, uuid, "preferredUsername", url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
        )
        SELECT 
          'Person', uuid, name, url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl",
          "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt" 
        FROM account 
        WHERE "applicationId" IS NULL
        `;
            yield utils.sequelize.query(query2);
        }
        {
            const data = {
                type: sequelize_typescript_1.DataType.INTEGER,
                allowNull: true,
                references: {
                    model: 'actor',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            };
            yield utils.queryInterface.addColumn('account', 'actorId', data);
            const query1 = `UPDATE account SET "actorId" = (SELECT id FROM actor WHERE actor.url = account.url)`;
            yield utils.sequelize.query(query1);
            data.allowNull = false;
            yield utils.queryInterface.changeColumn('account', 'actorId', data);
        }
        {
            const query = `  
    INSERT INTO actor 
    (
    type, uuid, "preferredUsername", url, "publicKey", "privateKey", "followersCount", "followingCount", "inboxUrl", "outboxUrl", 
    "sharedInboxUrl", "followersUrl", "followingUrl", "avatarId", "serverId", "createdAt", "updatedAt"
    )
    SELECT 
    'Group', "videoChannel".uuid, "videoChannel".uuid, "videoChannel".url, null, null, 0, 0, "videoChannel".url || '/inbox', 
    "videoChannel".url || '/outbox', "videoChannel".url || '/inbox', "videoChannel".url || '/followers', "videoChannel".url || '/following',
     null, account."serverId", "videoChannel"."createdAt", "videoChannel"."updatedAt" 
     FROM "videoChannel" 
     INNER JOIN "account" on "videoChannel"."accountId" = "account".id
    `;
            yield utils.sequelize.query(query);
        }
        {
            const data = {
                type: sequelize_typescript_1.DataType.INTEGER,
                allowNull: true,
                references: {
                    model: 'actor',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            };
            yield utils.queryInterface.addColumn('videoChannel', 'actorId', data);
            const query1 = `UPDATE "videoChannel" SET "actorId" = (SELECT id FROM actor WHERE actor.url = "videoChannel".url)`;
            yield utils.sequelize.query(query1);
            data.allowNull = false;
            yield utils.queryInterface.changeColumn('videoChannel', 'actorId', data);
        }
        {
            yield utils.queryInterface.renameTable('accountFollow', 'actorFollow');
            yield utils.queryInterface.renameColumn('actorFollow', 'accountId', 'actorId');
            yield utils.queryInterface.renameColumn('actorFollow', 'targetAccountId', 'targetActorId');
            try {
                yield utils.queryInterface.removeConstraint('actorFollow', 'AccountFollows_accountId_fkey');
                yield utils.queryInterface.removeConstraint('actorFollow', 'AccountFollows_targetAccountId_fkey');
            }
            catch (_a) {
                yield utils.queryInterface.removeConstraint('actorFollow', 'accountFollow_accountId_fkey');
                yield utils.queryInterface.removeConstraint('actorFollow', 'accountFollow_targetAccountId_fkey');
            }
            {
                const query1 = `UPDATE "actorFollow" 
      SET "actorId" = 
      (SELECT "account"."actorId" FROM account WHERE "account"."id" = "actorFollow"."actorId")`;
                yield utils.sequelize.query(query1);
                const query2 = `UPDATE "actorFollow" 
      SET "targetActorId" = 
      (SELECT "account"."actorId" FROM account WHERE "account"."id" = "actorFollow"."targetActorId")`;
                yield utils.sequelize.query(query2);
            }
            {
                const query1 = `ALTER TABLE ONLY "actorFollow"
    ADD CONSTRAINT "actorFollow_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES actor(id) ON UPDATE CASCADE ON DELETE CASCADE;`;
                yield utils.sequelize.query(query1);
                const query2 = `ALTER TABLE ONLY "actorFollow"
    ADD CONSTRAINT "actorFollow_targetActorId_fkey" FOREIGN KEY ("targetActorId") REFERENCES actor(id) ON UPDATE CASCADE ON DELETE CASCADE;`;
                yield utils.sequelize.query(query2);
            }
        }
        {
            yield utils.queryInterface.renameColumn('videoShare', 'accountId', 'actorId');
            try {
                yield utils.queryInterface.removeConstraint('videoShare', 'VideoShares_accountId_fkey');
            }
            catch (_b) {
                yield utils.queryInterface.removeConstraint('videoShare', 'videoShare_accountId_fkey');
            }
            const query = `UPDATE "videoShare" 
      SET "actorId" = 
      (SELECT "actorId" FROM account WHERE id = "videoShare"."actorId")`;
            yield utils.sequelize.query(query);
            {
                const query1 = `ALTER TABLE ONLY "videoShare"
    ADD CONSTRAINT "videoShare_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES actor(id) ON UPDATE CASCADE ON DELETE CASCADE;`;
                yield utils.sequelize.query(query1);
                const query2 = `ALTER TABLE ONLY "videoShare"
    ADD CONSTRAINT "videoShare_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES video(id) ON UPDATE CASCADE ON DELETE CASCADE;`;
                yield utils.sequelize.query(query2);
            }
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
            ];
            for (const columnToDelete of columnsToDelete) {
                yield utils.queryInterface.removeColumn('account', columnToDelete);
            }
        }
        {
            const columnsToDelete = [
                'uuid',
                'remote',
                'url'
            ];
            for (const columnToDelete of columnsToDelete) {
                yield utils.queryInterface.removeColumn('videoChannel', columnToDelete);
            }
        }
        {
            const query = 'SELECT * FROM "actor" WHERE "serverId" IS NULL AND "publicKey" IS NULL';
            const [res] = yield utils.sequelize.query(query);
            for (const actor of res) {
                const { privateKey, publicKey } = yield peertube_crypto_1.createPrivateAndPublicKeys();
                const queryUpdate = `UPDATE "actor" SET "publicKey" = '${publicKey}', "privateKey" = '${privateKey}' WHERE id = ${actor.id}`;
                yield utils.sequelize.query(queryUpdate);
            }
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
