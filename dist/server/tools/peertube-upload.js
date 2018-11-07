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
const program = require("commander");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const utils_1 = require("../tests/utils");
const index_1 = require("../tests/utils/index");
const videos_1 = require("../../shared/models/videos");
const cli_1 = require("./cli");
program
    .name('upload')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-n, --video-name <name>', 'Video name')
    .option('-P, --privacy <privacy_number>', 'Privacy')
    .option('-N, --nsfw', 'Video is Not Safe For Work')
    .option('-c, --category <category_number>', 'Category number')
    .option('-C, --channel-id <channel_id>', 'Channel ID')
    .option('-m, --comments-enabled', 'Enable comments')
    .option('-l, --licence <licence_number>', 'Licence number')
    .option('-L, --language <language_code>', 'Language ISO 639 code (fr or en...)')
    .option('-d, --video-description <description>', 'Video description')
    .option('-t, --tags <tags>', 'Video tags', list)
    .option('-b, --thumbnail <thumbnailPath>', 'Thumbnail path')
    .option('-v, --preview <previewPath>', 'Preview path')
    .option('-f, --file <file>', 'Video absolute file path')
    .parse(process.argv);
if (!program['tags'])
    program['tags'] = [];
if (!program['nsfw'])
    program['nsfw'] = false;
if (!program['privacy'])
    program['privacy'] = videos_1.VideoPrivacy.PUBLIC;
if (!program['commentsEnabled'])
    program['commentsEnabled'] = false;
cli_1.getSettings()
    .then(settings => {
    if ((!program['url'] ||
        !program['username'] ||
        !program['password']) &&
        (settings.remotes.length === 0)) {
        if (!program['url'])
            console.error('--url field is required.');
        if (!program['username'])
            console.error('--username field is required.');
        if (!program['password'])
            console.error('--password field is required.');
        if (!program['videoName'])
            console.error('--video-name field is required.');
        if (!program['file'])
            console.error('--file field is required.');
        process.exit(-1);
    }
    if ((!program['url'] ||
        !program['username'] ||
        !program['password']) &&
        (settings.remotes.length > 0)) {
        if (!program['url']) {
            program['url'] = (settings.default !== -1) ?
                settings.remotes[settings.default] :
                settings.remotes[0];
        }
        if (!program['username'])
            program['username'] = cli_1.netrc.machines[program['url']].login;
        if (!program['password'])
            program['password'] = cli_1.netrc.machines[program['url']].password;
    }
    if (!program['videoName'] ||
        !program['file']) {
        if (!program['videoName'])
            console.error('--video-name field is required.');
        if (!program['file'])
            console.error('--file field is required.');
        process.exit(-1);
    }
    if (path_1.isAbsolute(program['file']) === false) {
        console.error('File path should be absolute.');
        process.exit(-1);
    }
    run().catch(err => {
        console.error(err);
        process.exit(-1);
    });
});
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield utils_1.getClient(program['url']);
        const client = {
            id: res.body.client_id,
            secret: res.body.client_secret
        };
        const user = {
            username: program['username'],
            password: program['password']
        };
        let accessToken;
        try {
            const res2 = yield utils_1.login(program['url'], client, user);
            accessToken = res2.body.access_token;
        }
        catch (err) {
            throw new Error('Cannot authenticate. Please check your username/password.');
        }
        yield fs_extra_1.access(program['file'], fs_extra_1.constants.F_OK);
        console.log('Uploading %s video...', program['videoName']);
        const videoAttributes = {
            name: program['videoName'],
            category: program['category'],
            channelId: program['channelId'],
            licence: program['licence'],
            language: program['language'],
            nsfw: program['nsfw'],
            description: program['videoDescription'],
            tags: program['tags'],
            commentsEnabled: program['commentsEnabled'],
            fixture: program['file'],
            thumbnailfile: program['thumbnail'],
            previewfile: program['preview'],
            waitTranscoding: true,
            privacy: program['privacy'],
            support: undefined
        };
        yield index_1.uploadVideo(program['url'], accessToken, videoAttributes);
        console.log(`Video ${program['videoName']} uploaded.`);
        process.exit(0);
    });
}
function list(val) {
    return val.split(',');
}
