"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function up(utils) {
    const q = utils.queryInterface;
    const query = 'INSERT INTO "VideoFiles" ("videoId", "resolution", "size", "extname", "infoHash", "createdAt", "updatedAt") ' +
        'SELECT "id" AS "videoId", 0 AS "resolution", 0 AS "size", ' +
        '"extname"::"text"::"enum_VideoFiles_extname" as "extname", "infoHash", "createdAt", "updatedAt" ' +
        'FROM "Videos"';
    return utils.db.VideoFile.sync()
        .then(() => utils.sequelize.query(query))
        .then(() => {
        return q.removeColumn('Videos', 'extname');
    })
        .then(() => {
        return q.removeColumn('Videos', 'infoHash');
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
