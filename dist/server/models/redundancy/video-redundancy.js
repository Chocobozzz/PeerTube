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
var VideoRedundancyModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const actor_1 = require("../activitypub/actor");
const utils_1 = require("../utils");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const initializers_1 = require("../../initializers");
const video_file_1 = require("../video/video-file");
const utils_2 = require("../../helpers/utils");
const video_1 = require("../video/video");
const logger_1 = require("../../helpers/logger");
const shared_1 = require("../../../shared");
const video_channel_1 = require("../video/video-channel");
const server_1 = require("../server/server");
const lodash_1 = require("lodash");
const core_utils_1 = require("../../helpers/core-utils");
const Sequelize = require("sequelize");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_VIDEO"] = "WITH_VIDEO";
})(ScopeNames = exports.ScopeNames || (exports.ScopeNames = {}));
let VideoRedundancyModel = VideoRedundancyModel_1 = class VideoRedundancyModel extends sequelize_typescript_1.Model {
    static removeFile(instance) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!instance.strategy)
                return;
            const videoFile = yield video_file_1.VideoFileModel.loadWithVideo(instance.videoFileId);
            const logIdentifier = `${videoFile.Video.uuid}-${videoFile.resolution}`;
            logger_1.logger.info('Removing duplicated video file %s.', logIdentifier);
            videoFile.Video.removeFile(videoFile)
                .catch(err => logger_1.logger.error('Cannot delete %s files.', logIdentifier, { err }));
            return undefined;
        });
    }
    static loadLocalByFileId(videoFileId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                where: {
                    actorId: actor.id,
                    videoFileId
                }
            };
            return VideoRedundancyModel_1.scope(ScopeNames.WITH_VIDEO).findOne(query);
        });
    }
    static loadByUrl(url, transaction) {
        const query = {
            where: {
                url
            },
            transaction
        };
        return VideoRedundancyModel_1.findOne(query);
    }
    static isLocalByVideoUUIDExists(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                raw: true,
                attributes: ['id'],
                where: {
                    actorId: actor.id
                },
                include: [
                    {
                        attributes: [],
                        model: video_file_1.VideoFileModel,
                        required: true,
                        include: [
                            {
                                attributes: [],
                                model: video_1.VideoModel,
                                required: true,
                                where: {
                                    uuid
                                }
                            }
                        ]
                    }
                ]
            };
            return VideoRedundancyModel_1.findOne(query)
                .then(r => !!r);
        });
    }
    static getVideoSample(p) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield p;
            const ids = rows.map(r => r.id);
            const id = lodash_1.sample(ids);
            return video_1.VideoModel.loadWithFile(id, undefined, !core_utils_1.isTestInstance());
        });
    }
    static findMostViewToDuplicate(randomizedFactor) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                attributes: ['id', 'views'],
                limit: randomizedFactor,
                order: utils_1.getVideoSort('-views'),
                where: {
                    privacy: shared_1.VideoPrivacy.PUBLIC
                },
                include: [
                    yield VideoRedundancyModel_1.buildVideoFileForDuplication(),
                    VideoRedundancyModel_1.buildServerRedundancyInclude()
                ]
            };
            return VideoRedundancyModel_1.getVideoSample(video_1.VideoModel.unscoped().findAll(query));
        });
    }
    static findTrendingToDuplicate(randomizedFactor) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                attributes: ['id', 'views'],
                subQuery: false,
                group: 'VideoModel.id',
                limit: randomizedFactor,
                order: utils_1.getVideoSort('-trending'),
                where: {
                    privacy: shared_1.VideoPrivacy.PUBLIC
                },
                include: [
                    yield VideoRedundancyModel_1.buildVideoFileForDuplication(),
                    VideoRedundancyModel_1.buildServerRedundancyInclude(),
                    video_1.VideoModel.buildTrendingQuery(initializers_1.CONFIG.TRENDING.VIDEOS.INTERVAL_DAYS)
                ]
            };
            return VideoRedundancyModel_1.getVideoSample(video_1.VideoModel.unscoped().findAll(query));
        });
    }
    static findRecentlyAddedToDuplicate(randomizedFactor, minViews) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {
                attributes: ['id', 'publishedAt'],
                limit: randomizedFactor,
                order: utils_1.getVideoSort('-publishedAt'),
                where: {
                    privacy: shared_1.VideoPrivacy.PUBLIC,
                    views: {
                        [Sequelize.Op.gte]: minViews
                    }
                },
                include: [
                    yield VideoRedundancyModel_1.buildVideoFileForDuplication(),
                    VideoRedundancyModel_1.buildServerRedundancyInclude()
                ]
            };
            return VideoRedundancyModel_1.getVideoSample(video_1.VideoModel.unscoped().findAll(query));
        });
    }
    static loadOldestLocalThatAlreadyExpired(strategy, expiresAfterMs) {
        return __awaiter(this, void 0, void 0, function* () {
            const expiredDate = new Date();
            expiredDate.setMilliseconds(expiredDate.getMilliseconds() - expiresAfterMs);
            const actor = yield utils_2.getServerActor();
            const query = {
                where: {
                    actorId: actor.id,
                    strategy,
                    createdAt: {
                        [Sequelize.Op.lt]: expiredDate
                    }
                }
            };
            return VideoRedundancyModel_1.scope([ScopeNames.WITH_VIDEO]).findOne(query);
        });
    }
    static getTotalDuplicated(strategy) {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const options = {
                include: [
                    {
                        attributes: [],
                        model: VideoRedundancyModel_1,
                        required: true,
                        where: {
                            actorId: actor.id,
                            strategy
                        }
                    }
                ]
            };
            return video_file_1.VideoFileModel.sum('size', options);
        });
    }
    static listLocalExpired() {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                where: {
                    actorId: actor.id,
                    expiresOn: {
                        [Sequelize.Op.lt]: new Date()
                    }
                }
            };
            return VideoRedundancyModel_1.scope([ScopeNames.WITH_VIDEO]).findAll(query);
        });
    }
    static listRemoteExpired() {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                where: {
                    actorId: {
                        [Sequelize.Op.ne]: actor.id
                    },
                    expiresOn: {
                        [Sequelize.Op.lt]: new Date()
                    }
                }
            };
            return VideoRedundancyModel_1.scope([ScopeNames.WITH_VIDEO]).findAll(query);
        });
    }
    static listLocalOfServer(serverId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                where: {
                    actorId: actor.id
                },
                include: [
                    {
                        model: video_file_1.VideoFileModel,
                        required: true,
                        include: [
                            {
                                model: video_1.VideoModel,
                                required: true,
                                include: [
                                    {
                                        attributes: [],
                                        model: video_channel_1.VideoChannelModel.unscoped(),
                                        required: true,
                                        include: [
                                            {
                                                attributes: [],
                                                model: actor_1.ActorModel.unscoped(),
                                                required: true,
                                                where: {
                                                    serverId
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            return VideoRedundancyModel_1.findAll(query);
        });
    }
    static getStats(strategy) {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const query = {
                raw: true,
                attributes: [
                    [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('VideoFile.size')), '0'), 'totalUsed'],
                    [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('videoId'))), 'totalVideos'],
                    [Sequelize.fn('COUNT', Sequelize.col('videoFileId')), 'totalVideoFiles']
                ],
                where: {
                    strategy,
                    actorId: actor.id
                },
                include: [
                    {
                        attributes: [],
                        model: video_file_1.VideoFileModel,
                        required: true
                    }
                ]
            };
            return VideoRedundancyModel_1.find(query)
                .then((r) => ({
                totalUsed: parseInt(r.totalUsed.toString(), 10),
                totalVideos: r.totalVideos,
                totalVideoFiles: r.totalVideoFiles
            }));
        });
    }
    toActivityPubObject() {
        return {
            id: this.url,
            type: 'CacheFile',
            object: this.VideoFile.Video.url,
            expires: this.expiresOn.toISOString(),
            url: {
                type: 'Link',
                mimeType: initializers_1.VIDEO_EXT_MIMETYPE[this.VideoFile.extname],
                mediaType: initializers_1.VIDEO_EXT_MIMETYPE[this.VideoFile.extname],
                href: this.fileUrl,
                height: this.VideoFile.resolution,
                size: this.VideoFile.size,
                fps: this.VideoFile.fps
            }
        };
    }
    static buildVideoFileForDuplication() {
        return __awaiter(this, void 0, void 0, function* () {
            const actor = yield utils_2.getServerActor();
            const notIn = Sequelize.literal('(' +
                `SELECT "videoFileId" FROM "videoRedundancy" WHERE "actorId" = ${actor.id}` +
                ')');
            return {
                attributes: [],
                model: video_file_1.VideoFileModel.unscoped(),
                required: true,
                where: {
                    id: {
                        [Sequelize.Op.notIn]: notIn
                    }
                }
            };
        });
    }
    static buildServerRedundancyInclude() {
        return {
            attributes: [],
            model: video_channel_1.VideoChannelModel.unscoped(),
            required: true,
            include: [
                {
                    attributes: [],
                    model: actor_1.ActorModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: [],
                            model: server_1.ServerModel.unscoped(),
                            required: true,
                            where: {
                                redundancyAllowed: true
                            }
                        }
                    ]
                }
            ]
        };
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoRedundancyModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoRedundancyModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", Date)
], VideoRedundancyModel.prototype, "expiresOn", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoRedundancyFileUrl', value => utils_1.throwIfNotValid(value, misc_1.isUrlValid, 'fileUrl')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max)),
    __metadata("design:type", String)
], VideoRedundancyModel.prototype, "fileUrl", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoRedundancyUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS_REDUNDANCY.URL.max)),
    __metadata("design:type", String)
], VideoRedundancyModel.prototype, "url", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoRedundancyModel.prototype, "strategy", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_file_1.VideoFileModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoRedundancyModel.prototype, "videoFileId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_file_1.VideoFileModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_file_1.VideoFileModel)
], VideoRedundancyModel.prototype, "VideoFile", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => actor_1.ActorModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoRedundancyModel.prototype, "actorId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => actor_1.ActorModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", actor_1.ActorModel)
], VideoRedundancyModel.prototype, "Actor", void 0);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoRedundancyModel]),
    __metadata("design:returntype", Promise)
], VideoRedundancyModel, "removeFile", null);
VideoRedundancyModel = VideoRedundancyModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_VIDEO]: {
            include: [
                {
                    model: () => video_file_1.VideoFileModel,
                    required: true,
                    include: [
                        {
                            model: () => video_1.VideoModel,
                            required: true
                        }
                    ]
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoRedundancy',
        indexes: [
            {
                fields: ['videoFileId']
            },
            {
                fields: ['actorId']
            },
            {
                fields: ['url'],
                unique: true
            }
        ]
    })
], VideoRedundancyModel);
exports.VideoRedundancyModel = VideoRedundancyModel;
