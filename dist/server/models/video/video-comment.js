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
var VideoCommentModel_1;
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const initializers_1 = require("../../initializers");
const send_1 = require("../../lib/activitypub/send");
const account_1 = require("../account/account");
const actor_1 = require("../activitypub/actor");
const avatar_1 = require("../avatar/avatar");
const server_1 = require("../server/server");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_channel_1 = require("./video-channel");
const utils_2 = require("../../helpers/utils");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_ACCOUNT"] = "WITH_ACCOUNT";
    ScopeNames["WITH_IN_REPLY_TO"] = "WITH_IN_REPLY_TO";
    ScopeNames["WITH_VIDEO"] = "WITH_VIDEO";
    ScopeNames["ATTRIBUTES_FOR_API"] = "ATTRIBUTES_FOR_API";
})(ScopeNames || (ScopeNames = {}));
let VideoCommentModel = VideoCommentModel_1 = class VideoCommentModel extends sequelize_typescript_1.Model {
    static sendDeleteIfOwned(instance, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!instance.Account || !instance.Account.Actor) {
                instance.Account = (yield instance.$get('Account', {
                    include: [actor_1.ActorModel],
                    transaction: options.transaction
                }));
            }
            if (!instance.Video) {
                instance.Video = (yield instance.$get('Video', {
                    include: [
                        {
                            model: video_channel_1.VideoChannelModel,
                            include: [
                                {
                                    model: account_1.AccountModel,
                                    include: [
                                        {
                                            model: actor_1.ActorModel
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                    transaction: options.transaction
                }));
            }
            if (instance.isOwned()) {
                yield send_1.sendDeleteVideoComment(instance, options.transaction);
            }
        });
    }
    static loadById(id, t) {
        const query = {
            where: {
                id
            }
        };
        if (t !== undefined)
            query.transaction = t;
        return VideoCommentModel_1.findOne(query);
    }
    static loadByIdAndPopulateVideoAndAccountAndReply(id, t) {
        const query = {
            where: {
                id
            }
        };
        if (t !== undefined)
            query.transaction = t;
        return VideoCommentModel_1
            .scope([ScopeNames.WITH_VIDEO, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_IN_REPLY_TO])
            .findOne(query);
    }
    static loadByUrlAndPopulateAccount(url, t) {
        const query = {
            where: {
                url
            }
        };
        if (t !== undefined)
            query.transaction = t;
        return VideoCommentModel_1.scope([ScopeNames.WITH_ACCOUNT]).findOne(query);
    }
    static loadByUrlAndPopulateReplyAndVideo(url, t) {
        const query = {
            where: {
                url
            }
        };
        if (t !== undefined)
            query.transaction = t;
        return VideoCommentModel_1.scope([ScopeNames.WITH_IN_REPLY_TO, ScopeNames.WITH_VIDEO]).findOne(query);
    }
    static listThreadsForApi(videoId, start, count, sort, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const serverActor = yield utils_2.getServerActor();
            const serverAccountId = serverActor.Account.id;
            const userAccountId = user ? user.Account.id : undefined;
            const query = {
                offset: start,
                limit: count,
                order: utils_1.getSort(sort),
                where: {
                    videoId,
                    inReplyToCommentId: null,
                    accountId: {
                        [Sequelize.Op.notIn]: Sequelize.literal('(' + utils_1.buildBlockedAccountSQL(serverAccountId, userAccountId) + ')')
                    }
                }
            };
            const scopes = [
                ScopeNames.WITH_ACCOUNT,
                {
                    method: [ScopeNames.ATTRIBUTES_FOR_API, serverAccountId, userAccountId]
                }
            ];
            return VideoCommentModel_1
                .scope(scopes)
                .findAndCountAll(query)
                .then(({ rows, count }) => {
                return { total: count, data: rows };
            });
        });
    }
    static listThreadCommentsForApi(videoId, threadId, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const serverActor = yield utils_2.getServerActor();
            const serverAccountId = serverActor.Account.id;
            const userAccountId = user ? user.Account.id : undefined;
            const query = {
                order: [['createdAt', 'ASC'], ['updatedAt', 'ASC']],
                where: {
                    videoId,
                    [Sequelize.Op.or]: [
                        { id: threadId },
                        { originCommentId: threadId }
                    ],
                    accountId: {
                        [Sequelize.Op.notIn]: Sequelize.literal('(' + utils_1.buildBlockedAccountSQL(serverAccountId, userAccountId) + ')')
                    }
                }
            };
            const scopes = [
                ScopeNames.WITH_ACCOUNT,
                {
                    method: [ScopeNames.ATTRIBUTES_FOR_API, serverAccountId, userAccountId]
                }
            ];
            return VideoCommentModel_1
                .scope(scopes)
                .findAndCountAll(query)
                .then(({ rows, count }) => {
                return { total: count, data: rows };
            });
        });
    }
    static listThreadParentComments(comment, t, order = 'ASC') {
        const query = {
            order: [['createdAt', order]],
            where: {
                id: {
                    [Sequelize.Op.in]: Sequelize.literal('(' +
                        'WITH RECURSIVE children (id, "inReplyToCommentId") AS ( ' +
                        'SELECT id, "inReplyToCommentId" FROM "videoComment" WHERE id = ' + comment.id + ' UNION ' +
                        'SELECT p.id, p."inReplyToCommentId" from "videoComment" p ' +
                        'INNER JOIN children c ON c."inReplyToCommentId" = p.id) ' +
                        'SELECT id FROM children' +
                        ')'),
                    [Sequelize.Op.ne]: comment.id
                }
            },
            transaction: t
        };
        return VideoCommentModel_1
            .scope([ScopeNames.WITH_ACCOUNT])
            .findAll(query);
    }
    static listAndCountByVideoId(videoId, start, count, t, order = 'ASC') {
        const query = {
            order: [['createdAt', order]],
            offset: start,
            limit: count,
            where: {
                videoId
            },
            transaction: t
        };
        return VideoCommentModel_1.findAndCountAll(query);
    }
    static listForFeed(start, count, videoId) {
        const query = {
            order: [['createdAt', 'DESC']],
            offset: start,
            limit: count,
            where: {},
            include: [
                {
                    attributes: ['name', 'uuid'],
                    model: video_1.VideoModel.unscoped(),
                    required: true
                }
            ]
        };
        if (videoId)
            query.where['videoId'] = videoId;
        return VideoCommentModel_1
            .scope([ScopeNames.WITH_ACCOUNT])
            .findAll(query);
    }
    static getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalLocalVideoComments = yield VideoCommentModel_1.count({
                include: [
                    {
                        model: account_1.AccountModel,
                        required: true,
                        include: [
                            {
                                model: actor_1.ActorModel,
                                required: true,
                                where: {
                                    serverId: null
                                }
                            }
                        ]
                    }
                ]
            });
            const totalVideoComments = yield VideoCommentModel_1.count();
            return {
                totalLocalVideoComments,
                totalVideoComments
            };
        });
    }
    getThreadId() {
        return this.originCommentId || this.id;
    }
    isOwned() {
        return this.Account.isOwned();
    }
    toFormattedJSON() {
        return {
            id: this.id,
            url: this.url,
            text: this.text,
            threadId: this.originCommentId || this.id,
            inReplyToCommentId: this.inReplyToCommentId || null,
            videoId: this.videoId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            totalReplies: this.get('totalReplies') || 0,
            account: this.Account.toFormattedJSON()
        };
    }
    toActivityPubObject(threadParentComments) {
        let inReplyTo;
        if (this.inReplyToCommentId === null) {
            inReplyTo = this.Video.url;
        }
        else {
            inReplyTo = this.InReplyToVideoComment.url;
        }
        const tag = [];
        for (const parentComment of threadParentComments) {
            const actor = parentComment.Account.Actor;
            tag.push({
                type: 'Mention',
                href: actor.url,
                name: `@${actor.preferredUsername}@${actor.getHost()}`
            });
        }
        return {
            type: 'Note',
            id: this.url,
            content: this.text,
            inReplyTo,
            updated: this.updatedAt.toISOString(),
            published: this.createdAt.toISOString(),
            url: this.url,
            attributedTo: this.Account.Actor.url,
            tag
        };
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoCommentModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoCommentModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoCommentUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEOS.URL.max)),
    __metadata("design:type", String)
], VideoCommentModel.prototype, "url", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.TEXT),
    __metadata("design:type", String)
], VideoCommentModel.prototype, "text", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => VideoCommentModel_1),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoCommentModel.prototype, "originCommentId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => VideoCommentModel_1, {
        foreignKey: {
            name: 'originCommentId',
            allowNull: true
        },
        as: 'OriginVideoComment',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", VideoCommentModel)
], VideoCommentModel.prototype, "OriginVideoComment", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => VideoCommentModel_1),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoCommentModel.prototype, "inReplyToCommentId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => VideoCommentModel_1, {
        foreignKey: {
            name: 'inReplyToCommentId',
            allowNull: true
        },
        as: 'InReplyToVideoComment',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", VideoCommentModel)
], VideoCommentModel.prototype, "InReplyToVideoComment", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoCommentModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoCommentModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoCommentModel.prototype, "accountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", account_1.AccountModel)
], VideoCommentModel.prototype, "Account", void 0);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoCommentModel, Object]),
    __metadata("design:returntype", Promise)
], VideoCommentModel, "sendDeleteIfOwned", null);
VideoCommentModel = VideoCommentModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.ATTRIBUTES_FOR_API]: (serverAccountId, userAccountId) => {
            return {
                attributes: {
                    include: [
                        [
                            Sequelize.literal('(' +
                                'WITH "blocklist" AS (' + utils_1.buildBlockedAccountSQL(serverAccountId, userAccountId) + ')' +
                                'SELECT COUNT("replies"."id") - (' +
                                'SELECT COUNT("replies"."id") ' +
                                'FROM "videoComment" AS "replies" ' +
                                'WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ' +
                                'AND "accountId" IN (SELECT "id" FROM "blocklist")' +
                                ')' +
                                'FROM "videoComment" AS "replies" ' +
                                'WHERE "replies"."originCommentId" = "VideoCommentModel"."id" ' +
                                'AND "accountId" NOT IN (SELECT "id" FROM "blocklist")' +
                                ')'),
                            'totalReplies'
                        ]
                    ]
                }
            };
        },
        [ScopeNames.WITH_ACCOUNT]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    include: [
                        {
                            model: () => actor_1.ActorModel,
                            include: [
                                {
                                    model: () => server_1.ServerModel,
                                    required: false
                                },
                                {
                                    model: () => avatar_1.AvatarModel,
                                    required: false
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        [ScopeNames.WITH_IN_REPLY_TO]: {
            include: [
                {
                    model: () => VideoCommentModel_1,
                    as: 'InReplyToVideoComment'
                }
            ]
        },
        [ScopeNames.WITH_VIDEO]: {
            include: [
                {
                    model: () => video_1.VideoModel,
                    required: true,
                    include: [
                        {
                            model: () => video_channel_1.VideoChannelModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    model: () => account_1.AccountModel,
                                    required: true,
                                    include: [
                                        {
                                            model: () => actor_1.ActorModel,
                                            required: true
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoComment',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['videoId', 'originCommentId']
            },
            {
                fields: ['url'],
                unique: true
            },
            {
                fields: ['accountId']
            }
        ]
    })
], VideoCommentModel);
exports.VideoCommentModel = VideoCommentModel;
