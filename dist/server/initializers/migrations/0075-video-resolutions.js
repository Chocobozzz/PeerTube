"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const constants_1 = require("../../initializers/constants");
const ffmpeg_utils_1 = require("../../helpers/ffmpeg-utils");
const fs_extra_1 = require("fs-extra");
function up(utils) {
    const torrentDir = constants_1.CONFIG.STORAGE.TORRENTS_DIR;
    const videoFileDir = constants_1.CONFIG.STORAGE.VIDEOS_DIR;
    return fs_extra_1.readdir(videoFileDir)
        .then(videoFiles => {
        const tasks = [];
        for (const videoFile of videoFiles) {
            const matches = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([a-z0-9]+)/.exec(videoFile);
            if (matches === null) {
                console.log('Invalid video file name %s.', videoFile);
                continue;
            }
            const uuid = matches[1];
            const ext = matches[2];
            const p = ffmpeg_utils_1.getVideoFileResolution(path_1.join(videoFileDir, videoFile))
                .then(height => {
                const oldTorrentName = uuid + '.torrent';
                const newTorrentName = uuid + '-' + height + '.torrent';
                return fs_extra_1.rename(path_1.join(torrentDir, oldTorrentName), path_1.join(torrentDir, newTorrentName)).then(() => height);
            })
                .then(height => {
                const newVideoFileName = uuid + '-' + height + '.' + ext;
                return fs_extra_1.rename(path_1.join(videoFileDir, videoFile), path_1.join(videoFileDir, newVideoFileName)).then(() => height);
            })
                .then(height => {
                const query = 'UPDATE "VideoFiles" SET "resolution" = ' + height +
                    ' WHERE "videoId" = (SELECT "id" FROM "Videos" WHERE "uuid" = \'' + uuid + '\')';
                return utils.sequelize.query(query);
            });
            tasks.push(p);
        }
        return Promise.all(tasks).then(() => undefined);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
