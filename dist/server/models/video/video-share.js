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
Object.defineProperty(exports, "__esModule", { value: true });
var VideoShareModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const initializers_1 = require("../../initializers");
const account_1 = require("../account/account");
const actor_1 = require("../activitypub/actor");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_channel_1 = require("./video-channel");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["FULL"] = "FULL";
    ScopeNames["WITH_ACTOR"] = "WITH_ACTOR";
})(ScopeNames || (ScopeNames = {}));
let VideoShareModel = VideoShareModel_1 = class VideoShareModel extends sequelize_typescript_1.Model {
    static load(actorId, videoId, t) {
        return VideoShareModel_1.scope(ScopeNames.WITH_ACTOR).findOne({
            where: {
                actorId,
                videoId
            },
            transaction: t
        });
    }
    static loadByUrl(url, t) {
        return VideoShareModel_1.scope(ScopeNames.FULL).findOne({
            where: {
                url
            },
            transaction: t
        });
    }
    static loadActorsByShare(videoId, t) {
        const query = {
            where: {
                videoId
            },
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true
                }
            ],
            transaction: t
        };
        return VideoShareModel_1.scope(ScopeNames.FULL).findAll(query)
            .then(res => res.map(r => r.Actor));
    }
    static loadActorsByVideoOwner(actorOwnerId, t) {
        const query = {
            attributes: [],
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true
                },
                {
                    attributes: [],
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
                                    model: account_1.AccountModel.unscoped(),
                                    required: true,
                                    where: {
                                        actorId: actorOwnerId
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
            transaction: t
        };
        return VideoShareModel_1.scope(ScopeNames.FULL).findAll(query)
            .then(res => res.map(r => r.Actor));
    }
    static loadActorsByVideoChannel(videoChannelId, t) {
        const query = {
            attributes: [],
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true
                },
                {
                    attributes: [],
                    model: video_1.VideoModel,
                    required: true,
                    where: {
                        channelId: videoChannelId
                    }
                }
            ],
            transaction: t
        };
        return VideoShareModel_1.scope(ScopeNames.FULL)
            .findAll(query)
            .then(res => res.map(r => r.Actor));
    }
    static listAndCountByVideoId(videoId, start, count, t) {
        const query = {
            offset: start,
            limit: count,
            where: {
                videoId
            },
            transaction: t
        };
        return VideoShareModel_1.findAndCountAll(query);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoShareUrl', value => utils_1.throwIfNotValid(value, misc_1.isActivityPubUrlValid, 'url')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_SHARE.URL.max)),
    __metadata("design:type", String)
], VideoShareModel.prototype, "url", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoShareModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoShareModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => actor_1.ActorModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoShareModel.prototype, "actorId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => actor_1.ActorModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", actor_1.ActorModel)
], VideoShareModel.prototype, "Actor", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoShareModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoShareModel.prototype, "Video", void 0);
VideoShareModel = VideoShareModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.FULL]: {
            include: [
                {
                    model: () => actor_1.ActorModel,
                    required: true
                },
                {
                    model: () => video_1.VideoModel,
                    required: true
                }
            ]
        },
        [ScopeNames.WITH_ACTOR]: {
            include: [
                {
                    model: () => actor_1.ActorModel,
                    required: true
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoShare',
        indexes: [
            {
                fields: ['actorId']
            },
            {
                fields: ['videoId']
            },
            {
                fields: ['url'],
                unique: true
            }
        ]
    })
], VideoShareModel);
exports.VideoShareModel = VideoShareModel;
//# sourceMappingURL=video-share.js.map