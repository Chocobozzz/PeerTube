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
require('tls').DEFAULT_ECDH_CURVE = 'auto';
const program = require("commander");
const path_1 = require("path");
const videos_1 = require("../../shared/models/videos");
const requests_1 = require("../helpers/requests");
const initializers_1 = require("../initializers");
const utils_1 = require("../tests/utils");
const lodash_1 = require("lodash");
const prompt = require("prompt");
const fs_extra_1 = require("fs-extra");
const core_utils_1 = require("../helpers/core-utils");
const youtube_dl_1 = require("../helpers/youtube-dl");
const cli_1 = require("./cli");
let accessToken;
let client;
const processOptions = {
    cwd: __dirname,
    maxBuffer: Infinity
};
program
    .name('import-videos')
    .option('-u, --url <url>', 'Server url')
    .option('-U, --username <username>', 'Username')
    .option('-p, --password <token>', 'Password')
    .option('-t, --target-url <targetUrl>', 'Video target URL')
    .option('-l, --language <languageCode>', 'Language ISO 639 code (fr or en...)')
    .option('-v, --verbose', 'Verbose mode')
    .parse(process.argv);
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
        if (!program['targetUrl'])
            console.error('--targetUrl field is required.');
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
    if (!program['targetUrl']) {
        if (!program['targetUrl'])
            console.error('--targetUrl field is required.');
        process.exit(-1);
    }
    const user = {
        username: program['username'],
        password: program['password']
    };
    run(user, program['url']).catch(err => console.error(err));
});
function promptPassword() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res, rej) => {
            prompt.start();
            const schema = {
                properties: {
                    password: {
                        hidden: true,
                        required: true
                    }
                }
            };
            prompt.get(schema, function (err, result) {
                if (err) {
                    return rej(err);
                }
                return res(result.password);
            });
        });
    });
}
function run(user, url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user.password) {
            user.password = yield promptPassword();
        }
        const res = yield utils_1.getClient(url);
        client = {
            id: res.body.client_id,
            secret: res.body.client_secret
        };
        const res2 = yield utils_1.login(url, client, user);
        accessToken = res2.body.access_token;
        const youtubeDL = yield youtube_dl_1.safeGetYoutubeDL();
        const options = ['-j', '--flat-playlist', '--playlist-reverse'];
        youtubeDL.getInfo(program['targetUrl'], options, processOptions, (err, info) => __awaiter(this, void 0, void 0, function* () {
            if (err) {
                console.log(err.message);
                process.exit(1);
            }
            let infoArray;
            if (Array.isArray(info) === true) {
                infoArray = info.map(i => normalizeObject(i));
            }
            else {
                infoArray = [normalizeObject(info)];
            }
            console.log('Will download and upload %d videos.\n', infoArray.length);
            for (const info of infoArray) {
                yield processVideo(info, program['language'], processOptions.cwd, url, user);
            }
            console.log('Video/s for user %s imported: %s', program['username'], program['targetUrl']);
            process.exit(0);
        }));
    });
}
function processVideo(info, languageCode, cwd, url, user) {
    return new Promise((res) => __awaiter(this, void 0, void 0, function* () {
        if (program['verbose'])
            console.log('Fetching object.', info);
        const videoInfo = yield fetchObject(info);
        if (program['verbose'])
            console.log('Fetched object.', videoInfo);
        const result = yield utils_1.searchVideoWithSort(url, videoInfo.title, '-match');
        console.log('############################################################\n');
        if (result.body.data.find(v => v.name === videoInfo.title)) {
            console.log('Video "%s" already exists, don\'t reupload it.\n', videoInfo.title);
            return res();
        }
        const path = path_1.join(cwd, core_utils_1.sha256(videoInfo.url) + '.mp4');
        console.log('Downloading video "%s"...', videoInfo.title);
        const options = ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best', '-o', path];
        try {
            const youtubeDL = yield youtube_dl_1.safeGetYoutubeDL();
            youtubeDL.exec(videoInfo.url, options, processOptions, (err, output) => __awaiter(this, void 0, void 0, function* () {
                if (err) {
                    console.error(err);
                    return res();
                }
                console.log(output.join('\n'));
                yield uploadVideoOnPeerTube(normalizeObject(videoInfo), path, cwd, url, user, languageCode);
                return res();
            }));
        }
        catch (err) {
            console.log(err.message);
            return res();
        }
    }));
}
function uploadVideoOnPeerTube(videoInfo, videoPath, cwd, url, user, language) {
    return __awaiter(this, void 0, void 0, function* () {
        const category = yield getCategory(videoInfo.categories, url);
        const licence = getLicence(videoInfo.license);
        let tags = [];
        if (Array.isArray(videoInfo.tags)) {
            tags = videoInfo.tags
                .filter(t => t.length < initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TAG.max && t.length > initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TAG.min)
                .map(t => t.normalize())
                .slice(0, 5);
        }
        let thumbnailfile;
        if (videoInfo.thumbnail) {
            thumbnailfile = path_1.join(cwd, core_utils_1.sha256(videoInfo.thumbnail) + '.jpg');
            yield requests_1.doRequestAndSaveToFile({
                method: 'GET',
                uri: videoInfo.thumbnail
            }, thumbnailfile);
        }
        const videoAttributes = {
            name: lodash_1.truncate(videoInfo.title, {
                'length': initializers_1.CONSTRAINTS_FIELDS.VIDEOS.NAME.max,
                'separator': /,? +/,
                'omission': ' […]'
            }),
            category,
            licence,
            language,
            nsfw: isNSFW(videoInfo),
            waitTranscoding: true,
            commentsEnabled: true,
            description: videoInfo.description || undefined,
            support: undefined,
            tags,
            privacy: videos_1.VideoPrivacy.PUBLIC,
            fixture: videoPath,
            thumbnailfile,
            previewfile: thumbnailfile
        };
        console.log('\nUploading on PeerTube video "%s".', videoAttributes.name);
        try {
            yield utils_1.uploadVideo(url, accessToken, videoAttributes);
        }
        catch (err) {
            if (err.message.indexOf('401') !== -1) {
                console.log('Got 401 Unauthorized, token may have expired, renewing token and retry.');
                const res = yield utils_1.login(url, client, user);
                accessToken = res.body.access_token;
                yield utils_1.uploadVideo(url, accessToken, videoAttributes);
            }
            else {
                console.log(err.message);
                process.exit(1);
            }
        }
        yield fs_extra_1.remove(videoPath);
        if (thumbnailfile)
            yield fs_extra_1.remove(thumbnailfile);
        console.log('Uploaded video "%s"!\n', videoAttributes.name);
    });
}
function getCategory(categories, url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!categories)
            return undefined;
        const categoryString = categories[0];
        if (categoryString === 'News & Politics')
            return 11;
        const res = yield utils_1.getVideoCategories(url);
        const categoriesServer = res.body;
        for (const key of Object.keys(categoriesServer)) {
            const categoryServer = categoriesServer[key];
            if (categoryString.toLowerCase() === categoryServer.toLowerCase())
                return parseInt(key, 10);
        }
        return undefined;
    });
}
function getLicence(licence) {
    if (!licence)
        return undefined;
    if (licence.indexOf('Creative Commons Attribution licence') !== -1)
        return 1;
    return undefined;
}
function normalizeObject(obj) {
    const newObj = {};
    for (const key of Object.keys(obj)) {
        if (key === 'resolution')
            continue;
        const value = obj[key];
        if (typeof value === 'string') {
            newObj[key] = value.normalize();
        }
        else {
            newObj[key] = value;
        }
    }
    return newObj;
}
function fetchObject(info) {
    const url = buildUrl(info);
    return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
        const youtubeDL = yield youtube_dl_1.safeGetYoutubeDL();
        youtubeDL.getInfo(url, undefined, processOptions, (err, videoInfo) => __awaiter(this, void 0, void 0, function* () {
            if (err)
                return rej(err);
            const videoInfoWithUrl = Object.assign(videoInfo, { url });
            return res(normalizeObject(videoInfoWithUrl));
        }));
    }));
}
function buildUrl(info) {
    const webpageUrl = info.webpage_url;
    if (webpageUrl && webpageUrl.match(/^https?:\/\//))
        return webpageUrl;
    const url = info.url;
    if (url && url.match(/^https?:\/\//))
        return url;
    return 'https://www.youtube.com/watch?v=' + info.id;
}
function isNSFW(info) {
    if (info.age_limit && info.age_limit >= 16)
        return true;
    return false;
}
//# sourceMappingURL=peertube-import-videos.js.map