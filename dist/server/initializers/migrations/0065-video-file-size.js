"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const fs_extra_1 = require("fs-extra");
function up(utils) {
    return utils.db.Video.listOwnedAndPopulateAuthorAndTags()
        .then((videos) => {
        const tasks = [];
        videos.forEach(video => {
            video.VideoFiles.forEach(videoFile => {
                const p = new Promise((res, rej) => {
                    fs_extra_1.stat(video.getVideoFilePath(videoFile), (err, stats) => {
                        if (err)
                            return rej(err);
                        videoFile.size = stats.size;
                        videoFile.save().then(res).catch(rej);
                    });
                });
                tasks.push(p);
            });
        });
        return tasks;
    })
        .then((tasks) => {
        return Promise.all(tasks);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
