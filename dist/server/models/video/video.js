"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var VideoModel_1;
const Bluebird = require("bluebird");
const lodash_1 = require("lodash");
const magnetUtil = require("magnet-uri");
const parseTorrent = require("parse-torrent");
const path_1 = require("path");
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const shared_1 = require("../../../shared");
const core_utils_1 = require("../../helpers/core-utils");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const misc_2 = require("../../helpers/custom-validators/misc");
const videos_1 = require("../../helpers/custom-validators/videos");
const ffmpeg_utils_1 = require("../../helpers/ffmpeg-utils");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("../../helpers/utils");
const initializers_1 = require("../../initializers");
const send_1 = require("../../lib/activitypub/send");
const account_1 = require("../account/account");
const account_video_rate_1 = require("../account/account-video-rate");
const actor_1 = require("../activitypub/actor");
const avatar_1 = require("../avatar/avatar");
const server_1 = require("../server/server");
const utils_2 = require("../utils");
const tag_1 = require("./tag");
const video_abuse_1 = require("./video-abuse");
const video_channel_1 = require("./video-channel");
const video_comment_1 = require("./video-comment");
const video_file_1 = require("./video-file");
const video_share_1 = require("./video-share");
const video_tag_1 = require("./video-tag");
const schedule_video_update_1 = require("./schedule-video-update");
const video_caption_1 = require("./video-caption");
const video_blacklist_1 = require("./video-blacklist");
const fs_extra_1 = require("fs-extra");
const video_views_1 = require("./video-views");
const video_redundancy_1 = require("../redundancy/video-redundancy");
const video_format_utils_1 = require("./video-format-utils");
const validator = require("validator");
const user_video_history_1 = require("../account/user-video-history");
const indexes = [
    utils_2.buildTrigramSearchIndex('video_name_trigram', 'name'),
    { fields: ['createdAt'] },
    { fields: ['publishedAt'] },
    { fields: ['duration'] },
    { fields: ['category'] },
    { fields: ['licence'] },
    { fields: ['nsfw'] },
    { fields: ['language'] },
    { fields: ['waitTranscoding'] },
    { fields: ['state'] },
    { fields: ['remote'] },
    { fields: ['views'] },
    { fields: ['likes'] },
    { fields: ['channelId'] },
    {
        fields: ['uuid'],
        unique: true
    },
    {
        fields: ['url'],
        unique: true
    }
];
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["AVAILABLE_FOR_LIST_IDS"] = "AVAILABLE_FOR_LIST_IDS";
    ScopeNames["FOR_API"] = "FOR_API";
    ScopeNames["WITH_ACCOUNT_DETAILS"] = "WITH_ACCOUNT_DETAILS";
    ScopeNames["WITH_TAGS"] = "WITH_TAGS";
    ScopeNames["WITH_FILES"] = "WITH_FILES";
    ScopeNames["WITH_SCHEDULED_UPDATE"] = "WITH_SCHEDULED_UPDATE";
    ScopeNames["WITH_BLACKLISTED"] = "WITH_BLACKLISTED";
    ScopeNames["WITH_USER_HISTORY"] = "WITH_USER_HISTORY";
})(ScopeNames = exports.ScopeNames || (exports.ScopeNames = {}));
let VideoModel = VideoModel_1 = class VideoModel extends sequelize_typescript_1.Model {
    static sendDelete(instance, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (instance.isOwned()) {
                if (!instance.VideoChannel) {
                    instance.VideoChannel = (yield instance.$get('VideoChannel', {
                        include: [
                            {
                                model: account_1.AccountModel,
                                include: [actor_1.ActorModel]
                            }
                        ],
                        transaction: options.transaction
                    }));
                }
                return send_1.sendDeleteVideo(instance, options.transaction);
            }
            return undefined;
        });
    }
    static removeFiles(instance) {
        return __awaiter(this, void 0, void 0, function* () {
            const tasks = [];
            logger_1.logger.info('Removing files of video %s.', instance.url);
            tasks.push(instance.removeThumbnail());
            if (instance.isOwned()) {
                if (!Array.isArray(instance.VideoFiles)) {
                    instance.VideoFiles = (yield instance.$get('VideoFiles'));
                }
                tasks.push(instance.removePreview());
                instance.VideoFiles.forEach(file => {
                    tasks.push(instance.removeFile(file));
                    tasks.push(instance.removeTorrent(file));
                });
            }
            Promise.all(tasks)
                .catch(err => {
                logger_1.logger.error('Some errors when removing files of video %s in before destroy hook.', instance.uuid, { err });
            });
            return undefined;
        });
    }
    static list() {
        return VideoModel_1.scope(ScopeNames.WITH_FILES).findAll();
    }
    static listLocal() {
        const query = {
            where: {
                remote: false
            }
        };
        return VideoModel_1.scope(ScopeNames.WITH_FILES).findAll(query);
    }
    static listAllAndSharedByActorForOutbox(actorId, start, count) {
        function getRawQuery(select) {
            const queryVideo = 'SELECT ' + select + ' FROM "video" AS "Video" ' +
                'INNER JOIN "videoChannel" AS "VideoChannel" ON "VideoChannel"."id" = "Video"."channelId" ' +
                'INNER JOIN "account" AS "Account" ON "Account"."id" = "VideoChannel"."accountId" ' +
                'WHERE "Account"."actorId" = ' + actorId;
            const queryVideoShare = 'SELECT ' + select + ' FROM "videoShare" AS "VideoShare" ' +
                'INNER JOIN "video" AS "Video" ON "Video"."id" = "VideoShare"."videoId" ' +
                'WHERE "VideoShare"."actorId" = ' + actorId;
            return `(${queryVideo}) UNION (${queryVideoShare})`;
        }
        const rawQuery = getRawQuery('"Video"."id"');
        const rawCountQuery = getRawQuery('COUNT("Video"."id") as "total"');
        const query = {
            distinct: true,
            offset: start,
            limit: count,
            order: utils_2.getVideoSort('createdAt', ['Tags', 'name', 'ASC']),
            where: {
                id: {
                    [Sequelize.Op.in]: Sequelize.literal('(' + rawQuery + ')')
                },
                [Sequelize.Op.or]: [
                    { privacy: shared_1.VideoPrivacy.PUBLIC },
                    { privacy: shared_1.VideoPrivacy.UNLISTED }
                ]
            },
            include: [
                {
                    attributes: ['language'],
                    model: video_caption_1.VideoCaptionModel.unscoped(),
                    required: false
                },
                {
                    attributes: ['id', 'url'],
                    model: video_share_1.VideoShareModel.unscoped(),
                    required: false,
                    where: {
                        [Sequelize.Op.and]: [
                            {
                                id: {
                                    [Sequelize.Op.not]: null
                                }
                            },
                            {
                                actorId
                            }
                        ]
                    },
                    include: [
                        {
                            attributes: ['id', 'url'],
                            model: actor_1.ActorModel.unscoped()
                        }
                    ]
                },
                {
                    model: video_channel_1.VideoChannelModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: ['name'],
                            model: account_1.AccountModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    attributes: ['id', 'url', 'followersUrl'],
                                    model: actor_1.ActorModel.unscoped(),
                                    required: true
                                }
                            ]
                        },
                        {
                            attributes: ['id', 'url', 'followersUrl'],
                            model: actor_1.ActorModel.unscoped(),
                            required: true
                        }
                    ]
                },
                video_file_1.VideoFileModel,
                tag_1.TagModel
            ]
        };
        return Bluebird.all([
            VideoModel_1.findAll(query),
            VideoModel_1.sequelize.query(rawCountQuery, { type: Sequelize.QueryTypes.SELECT })
        ]).then(([rows, totals]) => {
            let totalVideos = 0;
            let totalVideoShares = 0;
            if (totals[0])
                totalVideos = parseInt(totals[0].total, 10);
            if (totals[1])
                totalVideoShares = parseInt(totals[1].total, 10);
            const total = totalVideos + totalVideoShares;
            return {
                data: rows,
                total: total
            };
        });
    }
    static listUserVideosForApi(accountId, start, count, sort, withFiles = false) {
        const query = {
            offset: start,
            limit: count,
            order: utils_2.getVideoSort(sort),
            include: [
                {
                    model: video_channel_1.VideoChannelModel,
                    required: true,
                    include: [
                        {
                            model: account_1.AccountModel,
                            where: {
                                id: accountId
                            },
                            required: true
                        }
                    ]
                },
                {
                    model: schedule_video_update_1.ScheduleVideoUpdateModel,
                    required: false
                },
                {
                    model: video_blacklist_1.VideoBlacklistModel,
                    required: false
                }
            ]
        };
        if (withFiles === true) {
            query.include.push({
                model: video_file_1.VideoFileModel.unscoped(),
                required: true
            });
        }
        return VideoModel_1.findAndCountAll(query).then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    static listForApi(options, countVideos = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.filter && options.filter === 'all-local' && !options.user.hasRight(shared_1.UserRight.SEE_ALL_VIDEOS)) {
                throw new Error('Try to filter all-local but no user has not the see all videos right');
            }
            const query = {
                offset: options.start,
                limit: options.count,
                order: utils_2.getVideoSort(options.sort)
            };
            let trendingDays;
            if (options.sort.endsWith('trending')) {
                trendingDays = initializers_1.CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS;
                query.group = 'VideoModel.id';
            }
            const serverActor = yield utils_1.getServerActor();
            const actorId = options.actorId !== undefined ? options.actorId : serverActor.id;
            const queryOptions = {
                actorId,
                serverAccountId: serverActor.Account.id,
                nsfw: options.nsfw,
                categoryOneOf: options.categoryOneOf,
                licenceOneOf: options.licenceOneOf,
                languageOneOf: options.languageOneOf,
                tagsOneOf: options.tagsOneOf,
                tagsAllOf: options.tagsAllOf,
                filter: options.filter,
                withFiles: options.withFiles,
                accountId: options.accountId,
                videoChannelId: options.videoChannelId,
                includeLocalVideos: options.includeLocalVideos,
                user: options.user,
                trendingDays
            };
            return VideoModel_1.getAvailableForApi(query, queryOptions, countVideos);
        });
    }
    static searchAndPopulateAccountAndServer(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereAnd = [];
            if (options.startDate || options.endDate) {
                const publishedAtRange = {};
                if (options.startDate)
                    publishedAtRange[Sequelize.Op.gte] = options.startDate;
                if (options.endDate)
                    publishedAtRange[Sequelize.Op.lte] = options.endDate;
                whereAnd.push({ publishedAt: publishedAtRange });
            }
            if (options.durationMin || options.durationMax) {
                const durationRange = {};
                if (options.durationMin)
                    durationRange[Sequelize.Op.gte] = options.durationMin;
                if (options.durationMax)
                    durationRange[Sequelize.Op.lte] = options.durationMax;
                whereAnd.push({ duration: durationRange });
            }
            const attributesInclude = [];
            const escapedSearch = VideoModel_1.sequelize.escape(options.search);
            const escapedLikeSearch = VideoModel_1.sequelize.escape('%' + options.search + '%');
            if (options.search) {
                whereAnd.push({
                    id: {
                        [Sequelize.Op.in]: Sequelize.literal('(' +
                            'SELECT "video"."id" FROM "video" ' +
                            'WHERE ' +
                            'lower(immutable_unaccent("video"."name")) % lower(immutable_unaccent(' + escapedSearch + ')) OR ' +
                            'lower(immutable_unaccent("video"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))' +
                            'UNION ALL ' +
                            'SELECT "video"."id" FROM "video" LEFT JOIN "videoTag" ON "videoTag"."videoId" = "video"."id" ' +
                            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
                            'WHERE "tag"."name" = ' + escapedSearch +
                            ')')
                    }
                });
                attributesInclude.push(utils_2.createSimilarityAttribute('VideoModel.name', options.search));
            }
            if (!options.search) {
                attributesInclude.push(Sequelize.literal('0 as similarity'));
            }
            const query = {
                attributes: {
                    include: attributesInclude
                },
                offset: options.start,
                limit: options.count,
                order: utils_2.getVideoSort(options.sort),
                where: {
                    [Sequelize.Op.and]: whereAnd
                }
            };
            const serverActor = yield utils_1.getServerActor();
            const queryOptions = {
                actorId: serverActor.id,
                serverAccountId: serverActor.Account.id,
                includeLocalVideos: options.includeLocalVideos,
                nsfw: options.nsfw,
                categoryOneOf: options.categoryOneOf,
                licenceOneOf: options.licenceOneOf,
                languageOneOf: options.languageOneOf,
                tagsOneOf: options.tagsOneOf,
                tagsAllOf: options.tagsAllOf,
                user: options.user,
                filter: options.filter
            };
            return VideoModel_1.getAvailableForApi(query, queryOptions);
        });
    }
    static load(id, t) {
        const where = VideoModel_1.buildWhereIdOrUUID(id);
        const options = {
            where,
            transaction: t
        };
        return VideoModel_1.findOne(options);
    }
    static loadOnlyId(id, t) {
        const where = VideoModel_1.buildWhereIdOrUUID(id);
        const options = {
            attributes: ['id'],
            where,
            transaction: t
        };
        return VideoModel_1.findOne(options);
    }
    static loadWithFile(id, t, logging) {
        return VideoModel_1.scope(ScopeNames.WITH_FILES)
            .findById(id, { transaction: t, logging });
    }
    static loadByUUIDWithFile(uuid) {
        const options = {
            where: {
                uuid
            }
        };
        return VideoModel_1
            .scope([ScopeNames.WITH_FILES])
            .findOne(options);
    }
    static loadByUrl(url, transaction) {
        const query = {
            where: {
                url
            },
            transaction
        };
        return VideoModel_1.findOne(query);
    }
    static loadByUrlAndPopulateAccount(url, transaction) {
        const query = {
            where: {
                url
            },
            transaction
        };
        return VideoModel_1.scope([ScopeNames.WITH_ACCOUNT_DETAILS, ScopeNames.WITH_FILES]).findOne(query);
    }
    static loadAndPopulateAccountAndServerAndTags(id, t, userId) {
        const where = VideoModel_1.buildWhereIdOrUUID(id);
        const options = {
            order: [['Tags', 'name', 'ASC']],
            where,
            transaction: t
        };
        const scopes = [
            ScopeNames.WITH_TAGS,
            ScopeNames.WITH_BLACKLISTED,
            ScopeNames.WITH_FILES,
            ScopeNames.WITH_ACCOUNT_DETAILS,
            ScopeNames.WITH_SCHEDULED_UPDATE
        ];
        if (userId) {
            scopes.push({ method: [ScopeNames.WITH_USER_HISTORY, userId] });
        }
        return VideoModel_1
            .scope(scopes)
            .findOne(options);
    }
    static getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalLocalVideos = yield VideoModel_1.count({
                where: {
                    remote: false
                }
            });
            const totalVideos = yield VideoModel_1.count();
            let totalLocalVideoViews = yield VideoModel_1.sum('views', {
                where: {
                    remote: false
                }
            });
            if (!totalLocalVideoViews)
                totalLocalVideoViews = 0;
            return {
                totalLocalVideos,
                totalLocalVideoViews,
                totalVideos
            };
        });
    }
    static incrementViews(id, views) {
        return VideoModel_1.increment('views', {
            by: views,
            where: {
                id
            }
        });
    }
    static getRandomFieldSamples(field, threshold, count) {
        return __awaiter(this, void 0, void 0, function* () {
            const serverActor = yield utils_1.getServerActor();
            const actorId = serverActor.id;
            const scopeOptions = {
                serverAccountId: serverActor.Account.id,
                actorId,
                includeLocalVideos: true
            };
            const query = {
                attributes: [field],
                limit: count,
                group: field,
                having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col(field)), {
                    [Sequelize.Op.gte]: threshold
                }),
                order: [this.sequelize.random()]
            };
            return VideoModel_1.scope({ method: [ScopeNames.AVAILABLE_FOR_LIST_IDS, scopeOptions] })
                .findAll(query)
                .then(rows => rows.map(r => r[field]));
        });
    }
    static buildTrendingQuery(trendingDays) {
        return {
            attributes: [],
            subQuery: false,
            model: video_views_1.VideoViewModel,
            required: false,
            where: {
                startDate: {
                    [Sequelize.Op.gte]: new Date(new Date().getTime() - (24 * 3600 * 1000) * trendingDays)
                }
            }
        };
    }
    static buildActorWhereWithFilter(filter) {
        if (filter && (filter === 'local' || filter === 'all-local')) {
            return {
                serverId: null
            };
        }
        return {};
    }
    static getAvailableForApi(query, options, countVideos = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const idsScope = {
                method: [
                    ScopeNames.AVAILABLE_FOR_LIST_IDS, options
                ]
            };
            const countOptions = Object.assign({}, options, { trendingDays: undefined });
            const countQuery = Object.assign({}, query, { attributes: undefined, group: undefined });
            const countScope = {
                method: [
                    ScopeNames.AVAILABLE_FOR_LIST_IDS, countOptions
                ]
            };
            const [count, rowsId] = yield Promise.all([
                countVideos ? VideoModel_1.scope(countScope).count(countQuery) : Promise.resolve(undefined),
                VideoModel_1.scope(idsScope).findAll(query)
            ]);
            const ids = rowsId.map(r => r.id);
            if (ids.length === 0)
                return { data: [], total: count };
            const apiScope = [
                {
                    method: [ScopeNames.FOR_API, { ids, withFiles: options.withFiles }]
                }
            ];
            if (options.user) {
                apiScope.push({ method: [ScopeNames.WITH_USER_HISTORY, options.user.id] });
            }
            const secondQuery = {
                offset: 0,
                limit: query.limit,
                attributes: query.attributes,
                order: [
                    Sequelize.literal(ids.map(id => `"VideoModel".id = ${id} DESC`).join(', '))
                ]
            };
            const rows = yield VideoModel_1.scope(apiScope).findAll(secondQuery);
            return {
                data: rows,
                total: count
            };
        });
    }
    static getCategoryLabel(id) {
        return initializers_1.VIDEO_CATEGORIES[id] || 'Misc';
    }
    static getLicenceLabel(id) {
        return initializers_1.VIDEO_LICENCES[id] || 'Unknown';
    }
    static getLanguageLabel(id) {
        return initializers_1.VIDEO_LANGUAGES[id] || 'Unknown';
    }
    static getPrivacyLabel(id) {
        return initializers_1.VIDEO_PRIVACIES[id] || 'Unknown';
    }
    static getStateLabel(id) {
        return initializers_1.VIDEO_STATES[id] || 'Unknown';
    }
    static buildWhereIdOrUUID(id) {
        return validator.isInt('' + id) ? { id } : { uuid: id };
    }
    getOriginalFile() {
        if (Array.isArray(this.VideoFiles) === false)
            return undefined;
        return lodash_1.maxBy(this.VideoFiles, file => file.resolution);
    }
    getVideoFilename(videoFile) {
        return this.uuid + '-' + videoFile.resolution + videoFile.extname;
    }
    getThumbnailName() {
        const extension = '.jpg';
        return this.uuid + extension;
    }
    getPreviewName() {
        const extension = '.jpg';
        return this.uuid + extension;
    }
    getTorrentFileName(videoFile) {
        const extension = '.torrent';
        return this.uuid + '-' + videoFile.resolution + extension;
    }
    isOwned() {
        return this.remote === false;
    }
    createPreview(videoFile) {
        return ffmpeg_utils_1.generateImageFromVideoFile(this.getVideoFilePath(videoFile), initializers_1.CONFIG.STORAGE.PREVIEWS_DIR, this.getPreviewName(), initializers_1.PREVIEWS_SIZE);
    }
    createThumbnail(videoFile) {
        return ffmpeg_utils_1.generateImageFromVideoFile(this.getVideoFilePath(videoFile), initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName(), initializers_1.THUMBNAILS_SIZE);
    }
    getTorrentFilePath(videoFile) {
        return path_1.join(initializers_1.CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile));
    }
    getVideoFilePath(videoFile) {
        return path_1.join(initializers_1.CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile));
    }
    createTorrentAndSetInfoHash(videoFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const options = {
                name: `${this.name} ${videoFile.resolution}p${videoFile.extname}`,
                createdBy: 'PeerTube',
                announceList: [
                    [initializers_1.CONFIG.WEBSERVER.WS + '://' + initializers_1.CONFIG.WEBSERVER.HOSTNAME + ':' + initializers_1.CONFIG.WEBSERVER.PORT + '/tracker/socket'],
                    [initializers_1.CONFIG.WEBSERVER.URL + '/tracker/announce']
                ],
                urlList: [initializers_1.CONFIG.WEBSERVER.URL + initializers_1.STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile)]
            };
            const torrent = yield core_utils_1.createTorrentPromise(this.getVideoFilePath(videoFile), options);
            const filePath = path_1.join(initializers_1.CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile));
            logger_1.logger.info('Creating torrent %s.', filePath);
            yield fs_extra_1.writeFile(filePath, torrent);
            const parsedTorrent = parseTorrent(torrent);
            videoFile.infoHash = parsedTorrent.infoHash;
        });
    }
    getEmbedStaticPath() {
        return '/videos/embed/' + this.uuid;
    }
    getThumbnailStaticPath() {
        return path_1.join(initializers_1.STATIC_PATHS.THUMBNAILS, this.getThumbnailName());
    }
    getPreviewStaticPath() {
        return path_1.join(initializers_1.STATIC_PATHS.PREVIEWS, this.getPreviewName());
    }
    toFormattedJSON(options) {
        return video_format_utils_1.videoModelToFormattedJSON(this, options);
    }
    toFormattedDetailsJSON() {
        return video_format_utils_1.videoModelToFormattedDetailsJSON(this);
    }
    getFormattedVideoFilesJSON() {
        return video_format_utils_1.videoFilesModelToFormattedJSON(this, this.VideoFiles);
    }
    toActivityPubObject() {
        return video_format_utils_1.videoModelToActivityPubObject(this);
    }
    getTruncatedDescription() {
        if (!this.description)
            return null;
        const maxLength = initializers_1.CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max;
        return core_utils_1.peertubeTruncate(this.description, maxLength);
    }
    getOriginalFileResolution() {
        const originalFilePath = this.getVideoFilePath(this.getOriginalFile());
        return ffmpeg_utils_1.getVideoFileResolution(originalFilePath);
    }
    getDescriptionAPIPath() {
        return `/api/${initializers_1.API_VERSION}/videos/${this.uuid}/description`;
    }
    removeThumbnail() {
        const thumbnailPath = path_1.join(initializers_1.CONFIG.STORAGE.THUMBNAILS_DIR, this.getThumbnailName());
        return fs_extra_1.remove(thumbnailPath)
            .catch(err => logger_1.logger.warn('Cannot delete thumbnail %s.', thumbnailPath, { err }));
    }
    removePreview() {
        const previewPath = path_1.join(initializers_1.CONFIG.STORAGE.PREVIEWS_DIR + this.getPreviewName());
        return fs_extra_1.remove(previewPath)
            .catch(err => logger_1.logger.warn('Cannot delete preview %s.', previewPath, { err }));
    }
    removeFile(videoFile) {
        const filePath = path_1.join(initializers_1.CONFIG.STORAGE.VIDEOS_DIR, this.getVideoFilename(videoFile));
        return fs_extra_1.remove(filePath)
            .catch(err => logger_1.logger.warn('Cannot delete file %s.', filePath, { err }));
    }
    removeTorrent(videoFile) {
        const torrentPath = path_1.join(initializers_1.CONFIG.STORAGE.TORRENTS_DIR, this.getTorrentFileName(videoFile));
        return fs_extra_1.remove(torrentPath)
            .catch(err => logger_1.logger.warn('Cannot delete torrent %s.', torrentPath, { err }));
    }
    isOutdated() {
        if (this.isOwned())
            return false;
        const now = Date.now();
        const createdAtTime = this.createdAt.getTime();
        const updatedAtTime = this.updatedAt.getTime();
        return (now - createdAtTime) > initializers_1.ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL &&
            (now - updatedAtTime) > initializers_1.ACTIVITY_PUB.VIDEO_REFRESH_INTERVAL;
    }
    getBaseUrls() {
        let baseUrlHttp;
        let baseUrlWs;
        if (this.isOwned()) {
            baseUrlHttp = initializers_1.CONFIG.WEBSERVER.URL;
            baseUrlWs = initializers_1.CONFIG.WEBSERVER.WS + '://' + initializers_1.CONFIG.WEBSERVER.HOSTNAME + ':' + initializers_1.CONFIG.WEBSERVER.PORT;
        }
        else {
            baseUrlHttp = initializers_1.REMOTE_SCHEME.HTTP + '://' + this.VideoChannel.Account.Actor.Server.host;
            baseUrlWs = initializers_1.REMOTE_SCHEME.WS + '://' + this.VideoChannel.Account.Actor.Server.host;
        }
        return { baseUrlHttp, baseUrlWs };
    }
    generateMagnetUri(videoFile, baseUrlHttp, baseUrlWs) {
        const xs = this.getTorrentUrl(videoFile, baseUrlHttp);
        const announce = [baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce'];
        let urlList = [this.getVideoFileUrl(videoFile, baseUrlHttp)];
        const redundancies = videoFile.RedundancyVideos;
        if (misc_2.isArray(redundancies))
            urlList = urlList.concat(redundancies.map(r => r.fileUrl));
        const magnetHash = {
            xs,
            announce,
            urlList,
            infoHash: videoFile.infoHash,
            name: this.name
        };
        return magnetUtil.encode(magnetHash);
    }
    getThumbnailUrl(baseUrlHttp) {
        return baseUrlHttp + initializers_1.STATIC_PATHS.THUMBNAILS + this.getThumbnailName();
    }
    getTorrentUrl(videoFile, baseUrlHttp) {
        return baseUrlHttp + initializers_1.STATIC_PATHS.TORRENTS + this.getTorrentFileName(videoFile);
    }
    getTorrentDownloadUrl(videoFile, baseUrlHttp) {
        return baseUrlHttp + initializers_1.STATIC_DOWNLOAD_PATHS.TORRENTS + this.getTorrentFileName(videoFile);
    }
    getVideoFileUrl(videoFile, baseUrlHttp) {
        return baseUrlHttp + initializers_1.STATIC_PATHS.WEBSEED + this.getVideoFilename(videoFile);
    }
    getVideoFileDownloadUrl(videoFile, baseUrlHttp) {
        return baseUrlHttp + initializers_1.STATIC_DOWNLOAD_PATHS.VIDEOS + this.getVideoFilename(videoFile);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(sequelize_typescript_1.DataType.UUIDV4),
    sequelize_typescript_1.IsUUID(4),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.UUID),
    __metadata("design:type", String)
], VideoModel.prototype, "uuid", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoName', value => utils_2.throwIfNotValid(value, videos_1.isVideoNameValid, 'name')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoModel.prototype, "name", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoCategory', value => utils_2.throwIfNotValid(value, videos_1.isVideoCategoryValid, 'category')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "category", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoLicence', value => utils_2.throwIfNotValid(value, videos_1.isVideoLicenceValid, 'licence')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "licence", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoLanguage', value => utils_2.throwIfNotValid(value, videos_1.isVideoLanguageValid, 'language')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.LANGUAGE.max)),
    __metadata("design:type", String)
], VideoModel.prototype, "language", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoPrivacy', value => utils_2.throwIfNotValid(value, videos_1.isVideoPrivacyValid, 'privacy')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "privacy", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoNSFW', value => utils_2.throwIfNotValid(value, misc_2.isBooleanValid, 'NSFW boolean')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], VideoModel.prototype, "nsfw", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoDescription', value => utils_2.throwIfNotValid(value, videos_1.isVideoDescriptionValid, 'description')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max)),
    __metadata("design:type", String)
], VideoModel.prototype, "description", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoSupport', value => utils_2.throwIfNotValid(value, videos_1.isVideoSupportValid, 'support')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.SUPPORT.max)),
    __metadata("design:type", String)
], VideoModel.prototype, "support", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoDuration', value => utils_2.throwIfNotValid(value, videos_1.isVideoDurationValid, 'duration')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "duration", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(0),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Min(0),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "views", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(0),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Min(0),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "likes", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(0),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Min(0),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "dislikes", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], VideoModel.prototype, "remote", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoUrl', value => utils_2.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.URL.max)),
    __metadata("design:type", String)
], VideoModel.prototype, "url", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], VideoModel.prototype, "commentsEnabled", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Boolean)
], VideoModel.prototype, "waitTranscoding", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoState', value => utils_2.throwIfNotValid(value, videos_1.isVideoStateValid, 'state')),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "state", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(Sequelize.NOW),
    sequelize_typescript_1.Column,
    __metadata("design:type", Date)
], VideoModel.prototype, "publishedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_channel_1.VideoChannelModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoModel.prototype, "channelId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_channel_1.VideoChannelModel, {
        foreignKey: {
            allowNull: true
        },
        hooks: true
    }),
    __metadata("design:type", video_channel_1.VideoChannelModel)
], VideoModel.prototype, "VideoChannel", void 0);
__decorate([
    sequelize_typescript_1.BelongsToMany(() => tag_1.TagModel, {
        foreignKey: 'videoId',
        through: () => video_tag_1.VideoTagModel,
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "Tags", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_abuse_1.VideoAbuseModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoAbuses", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_file_1.VideoFileModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        hooks: true,
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoFiles", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_share_1.VideoShareModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoShares", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => account_video_rate_1.AccountVideoRateModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "AccountVideoRates", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_comment_1.VideoCommentModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade',
        hooks: true
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoComments", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_views_1.VideoViewModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoViews", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => user_video_history_1.UserVideoHistoryModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "UserVideoHistories", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => schedule_video_update_1.ScheduleVideoUpdateModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", schedule_video_update_1.ScheduleVideoUpdateModel)
], VideoModel.prototype, "ScheduleVideoUpdate", void 0);
__decorate([
    sequelize_typescript_1.HasOne(() => video_blacklist_1.VideoBlacklistModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_blacklist_1.VideoBlacklistModel)
], VideoModel.prototype, "VideoBlacklist", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_caption_1.VideoCaptionModel, {
        foreignKey: {
            name: 'videoId',
            allowNull: false
        },
        onDelete: 'cascade',
        hooks: true,
        ['separate']: true
    }),
    __metadata("design:type", Array)
], VideoModel.prototype, "VideoCaptions", void 0);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoModel, Object]),
    __metadata("design:returntype", Promise)
], VideoModel, "sendDelete", null);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoModel]),
    __metadata("design:returntype", Promise)
], VideoModel, "removeFiles", null);
VideoModel = VideoModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.FOR_API]: (options) => {
            const accountInclude = {
                attributes: ['id', 'name'],
                model: account_1.AccountModel.unscoped(),
                required: true,
                include: [
                    {
                        attributes: ['id', 'uuid', 'preferredUsername', 'url', 'serverId', 'avatarId'],
                        model: actor_1.ActorModel.unscoped(),
                        required: true,
                        include: [
                            {
                                attributes: ['host'],
                                model: server_1.ServerModel.unscoped(),
                                required: false
                            },
                            {
                                model: avatar_1.AvatarModel.unscoped(),
                                required: false
                            }
                        ]
                    }
                ]
            };
            const videoChannelInclude = {
                attributes: ['name', 'description', 'id'],
                model: video_channel_1.VideoChannelModel.unscoped(),
                required: true,
                include: [
                    {
                        attributes: ['uuid', 'preferredUsername', 'url', 'serverId', 'avatarId'],
                        model: actor_1.ActorModel.unscoped(),
                        required: true,
                        include: [
                            {
                                attributes: ['host'],
                                model: server_1.ServerModel.unscoped(),
                                required: false
                            },
                            {
                                model: avatar_1.AvatarModel.unscoped(),
                                required: false
                            }
                        ]
                    },
                    accountInclude
                ]
            };
            const query = {
                where: {
                    id: {
                        [Sequelize.Op.any]: options.ids
                    }
                },
                include: [videoChannelInclude]
            };
            if (options.withFiles === true) {
                query.include.push({
                    model: video_file_1.VideoFileModel.unscoped(),
                    required: true
                });
            }
            return query;
        },
        [ScopeNames.AVAILABLE_FOR_LIST_IDS]: (options) => {
            const query = {
                raw: true,
                attributes: ['id'],
                where: {
                    id: {
                        [Sequelize.Op.and]: [
                            {
                                [Sequelize.Op.notIn]: Sequelize.literal('(SELECT "videoBlacklist"."videoId" FROM "videoBlacklist")')
                            }
                        ]
                    },
                    channelId: {
                        [Sequelize.Op.notIn]: Sequelize.literal('(' +
                            'SELECT id FROM "videoChannel" WHERE "accountId" IN (' +
                            utils_2.buildBlockedAccountSQL(options.serverAccountId, options.user ? options.user.Account.id : undefined) +
                            ')' +
                            ')')
                    }
                },
                include: []
            };
            if (!options.filter || options.filter !== 'all-local') {
                const privacyWhere = {
                    privacy: shared_1.VideoPrivacy.PUBLIC,
                    [Sequelize.Op.or]: [
                        {
                            state: shared_1.VideoState.PUBLISHED
                        },
                        {
                            [Sequelize.Op.and]: {
                                state: shared_1.VideoState.TO_TRANSCODE,
                                waitTranscoding: false
                            }
                        }
                    ]
                };
                Object.assign(query.where, privacyWhere);
            }
            if (options.filter || options.accountId || options.videoChannelId) {
                const videoChannelInclude = {
                    attributes: [],
                    model: video_channel_1.VideoChannelModel.unscoped(),
                    required: true
                };
                if (options.videoChannelId) {
                    videoChannelInclude.where = {
                        id: options.videoChannelId
                    };
                }
                if (options.filter || options.accountId) {
                    const accountInclude = {
                        attributes: [],
                        model: account_1.AccountModel.unscoped(),
                        required: true
                    };
                    if (options.filter) {
                        accountInclude.include = [
                            {
                                attributes: [],
                                model: actor_1.ActorModel.unscoped(),
                                required: true,
                                where: VideoModel_1.buildActorWhereWithFilter(options.filter)
                            }
                        ];
                    }
                    if (options.accountId) {
                        accountInclude.where = { id: options.accountId };
                    }
                    videoChannelInclude.include = [accountInclude];
                }
                query.include.push(videoChannelInclude);
            }
            if (options.actorId) {
                let localVideosReq = '';
                if (options.includeLocalVideos === true) {
                    localVideosReq = ' UNION ALL ' +
                        'SELECT "video"."id" AS "id" FROM "video" ' +
                        'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                        'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
                        'INNER JOIN "actor" ON "account"."actorId" = "actor"."id" ' +
                        'WHERE "actor"."serverId" IS NULL';
                }
                const actorIdNumber = parseInt(options.actorId.toString(), 10);
                query.where['id'][Sequelize.Op.and].push({
                    [Sequelize.Op.in]: Sequelize.literal('(' +
                        'SELECT "videoShare"."videoId" AS "id" FROM "videoShare" ' +
                        'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "videoShare"."actorId" ' +
                        'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
                        ' UNION ALL ' +
                        'SELECT "video"."id" AS "id" FROM "video" ' +
                        'INNER JOIN "videoChannel" ON "videoChannel"."id" = "video"."channelId" ' +
                        'INNER JOIN "account" ON "account"."id" = "videoChannel"."accountId" ' +
                        'INNER JOIN "actor" ON "account"."actorId" = "actor"."id" ' +
                        'INNER JOIN "actorFollow" ON "actorFollow"."targetActorId" = "actor"."id" ' +
                        'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
                        localVideosReq +
                        ')')
                });
            }
            if (options.withFiles === true) {
                query.where['id'][Sequelize.Op.and].push({
                    [Sequelize.Op.in]: Sequelize.literal('(SELECT "videoId" FROM "videoFile")')
                });
            }
            if (options.tagsAllOf || options.tagsOneOf) {
                const createTagsIn = (tags) => {
                    return tags.map(t => VideoModel_1.sequelize.escape(t))
                        .join(', ');
                };
                if (options.tagsOneOf) {
                    query.where['id'][Sequelize.Op.and].push({
                        [Sequelize.Op.in]: Sequelize.literal('(' +
                            'SELECT "videoId" FROM "videoTag" ' +
                            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
                            'WHERE "tag"."name" IN (' + createTagsIn(options.tagsOneOf) + ')' +
                            ')')
                    });
                }
                if (options.tagsAllOf) {
                    query.where['id'][Sequelize.Op.and].push({
                        [Sequelize.Op.in]: Sequelize.literal('(' +
                            'SELECT "videoId" FROM "videoTag" ' +
                            'INNER JOIN "tag" ON "tag"."id" = "videoTag"."tagId" ' +
                            'WHERE "tag"."name" IN (' + createTagsIn(options.tagsAllOf) + ')' +
                            'GROUP BY "videoTag"."videoId" HAVING COUNT(*) = ' + options.tagsAllOf.length +
                            ')')
                    });
                }
            }
            if (options.nsfw === true || options.nsfw === false) {
                query.where['nsfw'] = options.nsfw;
            }
            if (options.categoryOneOf) {
                query.where['category'] = {
                    [Sequelize.Op.or]: options.categoryOneOf
                };
            }
            if (options.licenceOneOf) {
                query.where['licence'] = {
                    [Sequelize.Op.or]: options.licenceOneOf
                };
            }
            if (options.languageOneOf) {
                query.where['language'] = {
                    [Sequelize.Op.or]: options.languageOneOf
                };
            }
            if (options.trendingDays) {
                query.include.push(VideoModel_1.buildTrendingQuery(options.trendingDays));
                query.subQuery = false;
            }
            return query;
        },
        [ScopeNames.WITH_ACCOUNT_DETAILS]: {
            include: [
                {
                    model: () => video_channel_1.VideoChannelModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: {
                                exclude: ['privateKey', 'publicKey']
                            },
                            model: () => actor_1.ActorModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    attributes: ['host'],
                                    model: () => server_1.ServerModel.unscoped(),
                                    required: false
                                },
                                {
                                    model: () => avatar_1.AvatarModel.unscoped(),
                                    required: false
                                }
                            ]
                        },
                        {
                            model: () => account_1.AccountModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    model: () => actor_1.ActorModel.unscoped(),
                                    attributes: {
                                        exclude: ['privateKey', 'publicKey']
                                    },
                                    required: true,
                                    include: [
                                        {
                                            attributes: ['host'],
                                            model: () => server_1.ServerModel.unscoped(),
                                            required: false
                                        },
                                        {
                                            model: () => avatar_1.AvatarModel.unscoped(),
                                            required: false
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        [ScopeNames.WITH_TAGS]: {
            include: [() => tag_1.TagModel]
        },
        [ScopeNames.WITH_BLACKLISTED]: {
            include: [
                {
                    attributes: ['id', 'reason'],
                    model: () => video_blacklist_1.VideoBlacklistModel,
                    required: false
                }
            ]
        },
        [ScopeNames.WITH_FILES]: {
            include: [
                {
                    model: () => video_file_1.VideoFileModel.unscoped(),
                    ['separate']: true,
                    required: false,
                    include: [
                        {
                            attributes: ['fileUrl'],
                            model: () => video_redundancy_1.VideoRedundancyModel.unscoped(),
                            required: false
                        }
                    ]
                }
            ]
        },
        [ScopeNames.WITH_SCHEDULED_UPDATE]: {
            include: [
                {
                    model: () => schedule_video_update_1.ScheduleVideoUpdateModel.unscoped(),
                    required: false
                }
            ]
        },
        [ScopeNames.WITH_USER_HISTORY]: (userId) => {
            return {
                include: [
                    {
                        attributes: ['currentTime'],
                        model: user_video_history_1.UserVideoHistoryModel.unscoped(),
                        required: false,
                        where: {
                            userId
                        }
                    }
                ]
            };
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'video',
        indexes
    })
], VideoModel);
exports.VideoModel = VideoModel;
