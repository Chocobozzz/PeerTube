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
const path = require("path");
const logger_1 = require("../helpers/logger");
const constants_1 = require("./constants");
const database_1 = require("./database");
const fs_extra_1 = require("fs-extra");
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        const tables = yield database_1.sequelizeTypescript.getQueryInterface().showAllTables();
        if (tables.length === 0)
            return;
        let actualVersion = null;
        const [rows] = yield database_1.sequelizeTypescript.query('SELECT "migrationVersion" FROM "application"');
        if (rows && rows[0] && rows[0].migrationVersion) {
            actualVersion = rows[0].migrationVersion;
        }
        if (actualVersion === null) {
            yield database_1.sequelizeTypescript.query('INSERT INTO "application" ("migrationVersion") VALUES (0)');
            actualVersion = 0;
        }
        if (actualVersion >= constants_1.LAST_MIGRATION_VERSION)
            return;
        logger_1.logger.info('Begin migrations.');
        const migrationScripts = yield getMigrationScripts();
        for (const migrationScript of migrationScripts) {
            try {
                yield executeMigration(actualVersion, migrationScript);
            }
            catch (err) {
                logger_1.logger.error('Cannot execute migration %s.', migrationScript.version, { err });
                process.exit(-1);
            }
        }
        logger_1.logger.info('Migrations finished. New migration version schema: %s', constants_1.LAST_MIGRATION_VERSION);
    });
}
exports.migrate = migrate;
function getMigrationScripts() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield fs_extra_1.readdir(path.join(__dirname, 'migrations'));
        const filesToMigrate = [];
        files
            .filter(file => file.endsWith('.js.map') === false)
            .forEach(file => {
            const version = file.split('-')[0];
            filesToMigrate.push({
                version,
                script: file
            });
        });
        return filesToMigrate;
    });
}
function executeMigration(actualVersion, entity) {
    return __awaiter(this, void 0, void 0, function* () {
        const versionScript = parseInt(entity.version, 10);
        if (versionScript <= actualVersion)
            return undefined;
        const migrationScriptName = entity.script;
        logger_1.logger.info('Executing %s migration script.', migrationScriptName);
        const migrationScript = require(path.join(__dirname, 'migrations', migrationScriptName));
        return database_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const options = {
                transaction: t,
                queryInterface: database_1.sequelizeTypescript.getQueryInterface(),
                sequelize: database_1.sequelizeTypescript
            };
            yield migrationScript.up(options);
            yield database_1.sequelizeTypescript.query('UPDATE "application" SET "migrationVersion" = ' + versionScript, { transaction: t });
        }));
    });
}
//# sourceMappingURL=migrator.js.map