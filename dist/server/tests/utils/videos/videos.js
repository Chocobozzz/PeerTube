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
const chai_1 = require("chai");
const fs_extra_1 = require("fs-extra");
const parseTorrent = require("parse-torrent");
const path_1 = require("path");
const request = require("supertest");
const __1 = require("../");
const videos_1 = require("../../../../shared/models/videos");
const initializers_1 = require("../../../initializers");
const index_1 = require("../index");
function getVideoCategories(url) {
    const path = '/api/v1/videos/categories';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getVideoCategories = getVideoCategories;
function getVideoLicences(url) {
    const path = '/api/v1/videos/licences';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getVideoLicences = getVideoLicences;
function getVideoLanguages(url) {
    const path = '/api/v1/videos/languages';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getVideoLanguages = getVideoLanguages;
function getVideoPrivacies(url) {
    const path = '/api/v1/videos/privacies';
    return __1.makeGetRequest({
        url,
        path,
        statusCodeExpected: 200
    });
}
exports.getVideoPrivacies = getVideoPrivacies;
function getVideo(url, id, expectedStatus = 200) {
    const path = '/api/v1/videos/' + id;
    return request(url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(expectedStatus);
}
exports.getVideo = getVideo;
function viewVideo(url, id, expectedStatus = 204, xForwardedFor) {
    const path = '/api/v1/videos/' + id + '/views';
    const req = request(url)
        .post(path)
        .set('Accept', 'application/json');
    if (xForwardedFor) {
        req.set('X-Forwarded-For', xForwardedFor);
    }
    return req.expect(expectedStatus);
}
exports.viewVideo = viewVideo;
function getVideoWithToken(url, token, id, expectedStatus = 200) {
    const path = '/api/v1/videos/' + id;
    return request(url)
        .get(path)
        .set('Authorization', 'Bearer ' + token)
        .set('Accept', 'application/json')
        .expect(expectedStatus);
}
exports.getVideoWithToken = getVideoWithToken;
function getVideoDescription(url, descriptionPath) {
    return request(url)
        .get(descriptionPath)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideoDescription = getVideoDescription;
function getVideosList(url) {
    const path = '/api/v1/videos';
    return request(url)
        .get(path)
        .query({ sort: 'name' })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideosList = getVideosList;
function getVideosListWithToken(url, token, query = {}) {
    const path = '/api/v1/videos';
    return request(url)
        .get(path)
        .set('Authorization', 'Bearer ' + token)
        .query(__1.immutableAssign(query, { sort: 'name' }))
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideosListWithToken = getVideosListWithToken;
function getLocalVideos(url) {
    const path = '/api/v1/videos';
    return request(url)
        .get(path)
        .query({ sort: 'name', filter: 'local' })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getLocalVideos = getLocalVideos;
function getMyVideos(url, accessToken, start, count, sort) {
    const path = '/api/v1/users/me/videos';
    const req = request(url)
        .get(path)
        .query({ start: start })
        .query({ count: count });
    if (sort)
        req.query({ sort });
    return req.set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getMyVideos = getMyVideos;
function getAccountVideos(url, accessToken, accountName, start, count, sort, query = {}) {
    const path = '/api/v1/accounts/' + accountName + '/videos';
    return __1.makeGetRequest({
        url,
        path,
        query: __1.immutableAssign(query, {
            start,
            count,
            sort
        }),
        token: accessToken,
        statusCodeExpected: 200
    });
}
exports.getAccountVideos = getAccountVideos;
function getVideoChannelVideos(url, accessToken, videoChannelName, start, count, sort, query = {}) {
    const path = '/api/v1/video-channels/' + videoChannelName + '/videos';
    return __1.makeGetRequest({
        url,
        path,
        query: __1.immutableAssign(query, {
            start,
            count,
            sort
        }),
        token: accessToken,
        statusCodeExpected: 200
    });
}
exports.getVideoChannelVideos = getVideoChannelVideos;
function getVideosListPagination(url, start, count, sort) {
    const path = '/api/v1/videos';
    const req = request(url)
        .get(path)
        .query({ start: start })
        .query({ count: count });
    if (sort)
        req.query({ sort });
    return req.set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideosListPagination = getVideosListPagination;
function getVideosListSort(url, sort) {
    const path = '/api/v1/videos';
    return request(url)
        .get(path)
        .query({ sort: sort })
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideosListSort = getVideosListSort;
function getVideosWithFilters(url, query) {
    const path = '/api/v1/videos';
    return request(url)
        .get(path)
        .query(query)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/);
}
exports.getVideosWithFilters = getVideosWithFilters;
function removeVideo(url, token, id, expectedStatus = 204) {
    const path = '/api/v1/videos';
    return request(url)
        .delete(path + '/' + id)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + token)
        .expect(expectedStatus);
}
exports.removeVideo = removeVideo;
function checkVideoFilesWereRemoved(videoUUID, serverNumber, directories = ['videos', 'thumbnails', 'torrents', 'previews', 'captions']) {
    return __awaiter(this, void 0, void 0, function* () {
        const testDirectory = 'test' + serverNumber;
        for (const directory of directories) {
            const directoryPath = path_1.join(__1.root(), testDirectory, directory);
            const directoryExists = fs_extra_1.existsSync(directoryPath);
            chai_1.expect(directoryExists).to.be.true;
            const files = yield fs_extra_1.readdir(directoryPath);
            for (const file of files) {
                chai_1.expect(file).to.not.contain(videoUUID);
            }
        }
    });
}
exports.checkVideoFilesWereRemoved = checkVideoFilesWereRemoved;
function uploadVideo(url, accessToken, videoAttributesArg, specialStatus = 200) {
    return __awaiter(this, void 0, void 0, function* () {
        const path = '/api/v1/videos/upload';
        let defaultChannelId = '1';
        try {
            const res = yield __1.getMyUserInformation(url, accessToken);
            defaultChannelId = res.body.videoChannels[0].id;
        }
        catch (e) { }
        const attributes = Object.assign({
            name: 'my super video',
            category: 5,
            licence: 4,
            language: 'zh',
            channelId: defaultChannelId,
            nsfw: true,
            waitTranscoding: false,
            description: 'my super description',
            support: 'my super support text',
            tags: ['tag'],
            privacy: videos_1.VideoPrivacy.PUBLIC,
            commentsEnabled: true,
            fixture: 'video_short.webm'
        }, videoAttributesArg);
        const req = request(url)
            .post(path)
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer ' + accessToken)
            .field('name', attributes.name)
            .field('nsfw', JSON.stringify(attributes.nsfw))
            .field('commentsEnabled', JSON.stringify(attributes.commentsEnabled))
            .field('waitTranscoding', JSON.stringify(attributes.waitTranscoding))
            .field('privacy', attributes.privacy.toString())
            .field('channelId', attributes.channelId);
        if (attributes.description !== undefined) {
            req.field('description', attributes.description);
        }
        if (attributes.language !== undefined) {
            req.field('language', attributes.language.toString());
        }
        if (attributes.category !== undefined) {
            req.field('category', attributes.category.toString());
        }
        if (attributes.licence !== undefined) {
            req.field('licence', attributes.licence.toString());
        }
        for (let i = 0; i < attributes.tags.length; i++) {
            req.field('tags[' + i + ']', attributes.tags[i]);
        }
        if (attributes.thumbnailfile !== undefined) {
            req.attach('thumbnailfile', __1.buildAbsoluteFixturePath(attributes.thumbnailfile));
        }
        if (attributes.previewfile !== undefined) {
            req.attach('previewfile', __1.buildAbsoluteFixturePath(attributes.previewfile));
        }
        if (attributes.scheduleUpdate) {
            req.field('scheduleUpdate[updateAt]', attributes.scheduleUpdate.updateAt);
            if (attributes.scheduleUpdate.privacy) {
                req.field('scheduleUpdate[privacy]', attributes.scheduleUpdate.privacy);
            }
        }
        return req.attach('videofile', __1.buildAbsoluteFixturePath(attributes.fixture))
            .expect(specialStatus);
    });
}
exports.uploadVideo = uploadVideo;
function updateVideo(url, accessToken, id, attributes, statusCodeExpected = 204) {
    const path = '/api/v1/videos/' + id;
    const body = {};
    if (attributes.name)
        body['name'] = attributes.name;
    if (attributes.category)
        body['category'] = attributes.category;
    if (attributes.licence)
        body['licence'] = attributes.licence;
    if (attributes.language)
        body['language'] = attributes.language;
    if (attributes.nsfw !== undefined)
        body['nsfw'] = JSON.stringify(attributes.nsfw);
    if (attributes.commentsEnabled !== undefined)
        body['commentsEnabled'] = JSON.stringify(attributes.commentsEnabled);
    if (attributes.description)
        body['description'] = attributes.description;
    if (attributes.tags)
        body['tags'] = attributes.tags;
    if (attributes.privacy)
        body['privacy'] = attributes.privacy;
    if (attributes.channelId)
        body['channelId'] = attributes.channelId;
    if (attributes.scheduleUpdate)
        body['scheduleUpdate'] = attributes.scheduleUpdate;
    if (attributes.thumbnailfile || attributes.previewfile) {
        const attaches = {};
        if (attributes.thumbnailfile)
            attaches.thumbnailfile = attributes.thumbnailfile;
        if (attributes.previewfile)
            attaches.previewfile = attributes.previewfile;
        return __1.makeUploadRequest({
            url,
            method: 'PUT',
            path,
            token: accessToken,
            fields: body,
            attaches,
            statusCodeExpected
        });
    }
    return __1.makePutBodyRequest({
        url,
        path,
        fields: body,
        token: accessToken,
        statusCodeExpected
    });
}
exports.updateVideo = updateVideo;
function rateVideo(url, accessToken, id, rating, specialStatus = 204) {
    const path = '/api/v1/videos/' + id + '/rate';
    return request(url)
        .put(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + accessToken)
        .send({ rating })
        .expect(specialStatus);
}
exports.rateVideo = rateVideo;
function parseTorrentVideo(server, videoUUID, resolution) {
    return new Promise((res, rej) => {
        const torrentName = videoUUID + '-' + resolution + '.torrent';
        const torrentPath = path_1.join(__dirname, '..', '..', '..', '..', 'test' + server.serverNumber, 'torrents', torrentName);
        fs_extra_1.readFile(torrentPath, (err, data) => {
            if (err)
                return rej(err);
            return res(parseTorrent(data));
        });
    });
}
exports.parseTorrentVideo = parseTorrentVideo;
function completeVideoCheck(url, video, attributes) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!attributes.likes)
            attributes.likes = 0;
        if (!attributes.dislikes)
            attributes.dislikes = 0;
        chai_1.expect(video.name).to.equal(attributes.name);
        chai_1.expect(video.category.id).to.equal(attributes.category);
        chai_1.expect(video.category.label).to.equal(attributes.category !== null ? initializers_1.VIDEO_CATEGORIES[attributes.category] : 'Misc');
        chai_1.expect(video.licence.id).to.equal(attributes.licence);
        chai_1.expect(video.licence.label).to.equal(attributes.licence !== null ? initializers_1.VIDEO_LICENCES[attributes.licence] : 'Unknown');
        chai_1.expect(video.language.id).to.equal(attributes.language);
        chai_1.expect(video.language.label).to.equal(attributes.language !== null ? initializers_1.VIDEO_LANGUAGES[attributes.language] : 'Unknown');
        chai_1.expect(video.privacy.id).to.deep.equal(attributes.privacy);
        chai_1.expect(video.privacy.label).to.deep.equal(initializers_1.VIDEO_PRIVACIES[attributes.privacy]);
        chai_1.expect(video.nsfw).to.equal(attributes.nsfw);
        chai_1.expect(video.description).to.equal(attributes.description);
        chai_1.expect(video.account.id).to.be.a('number');
        chai_1.expect(video.account.uuid).to.be.a('string');
        chai_1.expect(video.account.host).to.equal(attributes.account.host);
        chai_1.expect(video.account.name).to.equal(attributes.account.name);
        chai_1.expect(video.channel.displayName).to.equal(attributes.channel.displayName);
        chai_1.expect(video.channel.name).to.equal(attributes.channel.name);
        chai_1.expect(video.likes).to.equal(attributes.likes);
        chai_1.expect(video.dislikes).to.equal(attributes.dislikes);
        chai_1.expect(video.isLocal).to.equal(attributes.isLocal);
        chai_1.expect(video.duration).to.equal(attributes.duration);
        chai_1.expect(index_1.dateIsValid(video.createdAt)).to.be.true;
        chai_1.expect(index_1.dateIsValid(video.publishedAt)).to.be.true;
        chai_1.expect(index_1.dateIsValid(video.updatedAt)).to.be.true;
        if (attributes.publishedAt) {
            chai_1.expect(video.publishedAt).to.equal(attributes.publishedAt);
        }
        const res = yield getVideo(url, video.uuid);
        const videoDetails = res.body;
        chai_1.expect(videoDetails.files).to.have.lengthOf(attributes.files.length);
        chai_1.expect(videoDetails.tags).to.deep.equal(attributes.tags);
        chai_1.expect(videoDetails.account.name).to.equal(attributes.account.name);
        chai_1.expect(videoDetails.account.host).to.equal(attributes.account.host);
        chai_1.expect(video.channel.displayName).to.equal(attributes.channel.displayName);
        chai_1.expect(video.channel.name).to.equal(attributes.channel.name);
        chai_1.expect(videoDetails.channel.host).to.equal(attributes.account.host);
        chai_1.expect(videoDetails.channel.isLocal).to.equal(attributes.channel.isLocal);
        chai_1.expect(index_1.dateIsValid(videoDetails.channel.createdAt.toString())).to.be.true;
        chai_1.expect(index_1.dateIsValid(videoDetails.channel.updatedAt.toString())).to.be.true;
        chai_1.expect(videoDetails.commentsEnabled).to.equal(attributes.commentsEnabled);
        for (const attributeFile of attributes.files) {
            const file = videoDetails.files.find(f => f.resolution.id === attributeFile.resolution);
            chai_1.expect(file).not.to.be.undefined;
            let extension = path_1.extname(attributes.fixture);
            if (attributes.account.host === 'localhost:9002')
                extension = '.mp4';
            const magnetUri = file.magnetUri;
            chai_1.expect(file.magnetUri).to.have.lengthOf.above(2);
            chai_1.expect(file.torrentUrl).to.equal(`http://${attributes.account.host}/static/torrents/${videoDetails.uuid}-${file.resolution.id}.torrent`);
            chai_1.expect(file.fileUrl).to.equal(`http://${attributes.account.host}/static/webseed/${videoDetails.uuid}-${file.resolution.id}${extension}`);
            chai_1.expect(file.resolution.id).to.equal(attributeFile.resolution);
            chai_1.expect(file.resolution.label).to.equal(attributeFile.resolution + 'p');
            const minSize = attributeFile.size - ((10 * attributeFile.size) / 100);
            const maxSize = attributeFile.size + ((10 * attributeFile.size) / 100);
            chai_1.expect(file.size, 'File size for resolution ' + file.resolution.label + ' outside confidence interval (' + minSize + '> size <' + maxSize + ')')
                .to.be.above(minSize).and.below(maxSize);
            {
                yield __1.testImage(url, attributes.thumbnailfile || attributes.fixture, videoDetails.thumbnailPath);
            }
            if (attributes.previewfile) {
                yield __1.testImage(url, attributes.previewfile, videoDetails.previewPath);
            }
            const torrent = yield index_1.webtorrentAdd(magnetUri, true);
            chai_1.expect(torrent.files).to.be.an('array');
            chai_1.expect(torrent.files.length).to.equal(1);
            chai_1.expect(torrent.files[0].path).to.exist.and.to.not.equal('');
        }
    });
}
exports.completeVideoCheck = completeVideoCheck;
//# sourceMappingURL=videos.js.map