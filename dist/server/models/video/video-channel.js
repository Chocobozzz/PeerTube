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
var VideoChannelModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const video_channels_1 = require("../../helpers/custom-validators/video-channels");
const send_1 = require("../../lib/activitypub/send");
const account_1 = require("../account/account");
const actor_1 = require("../activitypub/actor");
const utils_1 = require("../utils");
const video_1 = require("./video");
const initializers_1 = require("../../initializers");
const server_1 = require("../server/server");
const indexes = [
    utils_1.buildTrigramSearchIndex('video_channel_name_trigram', 'name'),
    {
        fields: ['accountId']
    },
    {
        fields: ['actorId']
    }
];
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["AVAILABLE_FOR_LIST"] = "AVAILABLE_FOR_LIST";
    ScopeNames["WITH_ACCOUNT"] = "WITH_ACCOUNT";
    ScopeNames["WITH_ACTOR"] = "WITH_ACTOR";
    ScopeNames["WITH_VIDEOS"] = "WITH_VIDEOS";
})(ScopeNames || (ScopeNames = {}));
let VideoChannelModel = VideoChannelModel_1 = class VideoChannelModel extends sequelize_typescript_1.Model {
    static sendDeleteIfOwned(instance, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!instance.Actor) {
                instance.Actor = (yield instance.$get('Actor', { transaction: options.transaction }));
            }
            if (instance.Actor.isOwned()) {
                return send_1.sendDeleteActor(instance.Actor, options.transaction);
            }
            return undefined;
        });
    }
    static countByAccount(accountId) {
        const query = {
            where: {
                accountId
            }
        };
        return VideoChannelModel_1.count(query);
    }
    static listForApi(actorId, start, count, sort) {
        const query = {
            offset: start,
            limit: count,
            order: utils_1.getSort(sort)
        };
        const scopes = {
            method: [ScopeNames.AVAILABLE_FOR_LIST, { actorId }]
        };
        return VideoChannelModel_1
            .scope(scopes)
            .findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    static searchForApi(options) {
        const attributesInclude = [];
        const escapedSearch = video_1.VideoModel.sequelize.escape(options.search);
        const escapedLikeSearch = video_1.VideoModel.sequelize.escape('%' + options.search + '%');
        attributesInclude.push(utils_1.createSimilarityAttribute('VideoChannelModel.name', options.search));
        const query = {
            attributes: {
                include: attributesInclude
            },
            offset: options.start,
            limit: options.count,
            order: utils_1.getSort(options.sort),
            where: {
                [sequelize_typescript_1.Sequelize.Op.or]: [
                    sequelize_typescript_1.Sequelize.literal('lower(immutable_unaccent("VideoChannelModel"."name")) % lower(immutable_unaccent(' + escapedSearch + '))'),
                    sequelize_typescript_1.Sequelize.literal('lower(immutable_unaccent("VideoChannelModel"."name")) LIKE lower(immutable_unaccent(' + escapedLikeSearch + '))')
                ]
            }
        };
        const scopes = {
            method: [ScopeNames.AVAILABLE_FOR_LIST, { actorId: options.actorId }]
        };
        return VideoChannelModel_1
            .scope(scopes)
            .findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    static listByAccount(accountId) {
        const query = {
            order: utils_1.getSort('createdAt'),
            include: [
                {
                    model: account_1.AccountModel,
                    where: {
                        id: accountId
                    },
                    required: true
                }
            ]
        };
        return VideoChannelModel_1
            .findAndCountAll(query)
            .then(({ rows, count }) => {
            return { total: count, data: rows };
        });
    }
    static loadByIdAndPopulateAccount(id) {
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT])
            .findById(id);
    }
    static loadByIdAndAccount(id, accountId) {
        const query = {
            where: {
                id,
                accountId
            }
        };
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT])
            .findOne(query);
    }
    static loadAndPopulateAccount(id) {
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT])
            .findById(id);
    }
    static loadByUUIDAndPopulateAccount(uuid) {
        const query = {
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    where: {
                        uuid
                    }
                }
            ]
        };
        return VideoChannelModel_1
            .scope([ScopeNames.WITH_ACCOUNT])
            .findOne(query);
    }
    static loadByUrlAndPopulateAccount(url) {
        const query = {
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    where: {
                        url
                    }
                }
            ]
        };
        return VideoChannelModel_1
            .scope([ScopeNames.WITH_ACCOUNT])
            .findOne(query);
    }
    static loadLocalByNameAndPopulateAccount(name) {
        const query = {
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    where: {
                        preferredUsername: name,
                        serverId: null
                    }
                }
            ]
        };
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT])
            .findOne(query);
    }
    static loadByNameAndHostAndPopulateAccount(name, host) {
        const query = {
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    where: {
                        preferredUsername: name
                    },
                    include: [
                        {
                            model: server_1.ServerModel,
                            required: true,
                            where: { host }
                        }
                    ]
                }
            ]
        };
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT])
            .findOne(query);
    }
    static loadAndPopulateAccountAndVideos(id) {
        const options = {
            include: [
                video_1.VideoModel
            ]
        };
        return VideoChannelModel_1.unscoped()
            .scope([ScopeNames.WITH_ACTOR, ScopeNames.WITH_ACCOUNT, ScopeNames.WITH_VIDEOS])
            .findById(id, options);
    }
    toFormattedJSON() {
        const actor = this.Actor.toFormattedJSON();
        const videoChannel = {
            id: this.id,
            displayName: this.getDisplayName(),
            description: this.description,
            support: this.support,
            isLocal: this.Actor.isOwned(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            ownerAccount: undefined
        };
        if (this.Account)
            videoChannel.ownerAccount = this.Account.toFormattedJSON();
        return Object.assign(actor, videoChannel);
    }
    toActivityPubObject() {
        const obj = this.Actor.toActivityPubObject(this.name, 'VideoChannel');
        return Object.assign(obj, {
            summary: this.description,
            support: this.support,
            attributedTo: [
                {
                    type: 'Person',
                    id: this.Account.Actor.url
                }
            ]
        });
    }
    getDisplayName() {
        return this.name;
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoChannelName', value => utils_1.throwIfNotValid(value, video_channels_1.isVideoChannelNameValid, 'name')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoChannelModel.prototype, "name", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoChannelDescription', value => utils_1.throwIfNotValid(value, video_channels_1.isVideoChannelDescriptionValid, 'description')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_CHANNELS.DESCRIPTION.max)),
    __metadata("design:type", String)
], VideoChannelModel.prototype, "description", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Default(null),
    sequelize_typescript_1.Is('VideoChannelSupport', value => utils_1.throwIfNotValid(value, video_channels_1.isVideoChannelSupportValid, 'support')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_CHANNELS.SUPPORT.max)),
    __metadata("design:type", String)
], VideoChannelModel.prototype, "support", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoChannelModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoChannelModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => actor_1.ActorModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoChannelModel.prototype, "actorId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => actor_1.ActorModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", actor_1.ActorModel)
], VideoChannelModel.prototype, "Actor", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoChannelModel.prototype, "accountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: false
        },
        hooks: true
    }),
    __metadata("design:type", account_1.AccountModel)
], VideoChannelModel.prototype, "Account", void 0);
__decorate([
    sequelize_typescript_1.HasMany(() => video_1.VideoModel, {
        foreignKey: {
            name: 'channelId',
            allowNull: false
        },
        onDelete: 'CASCADE',
        hooks: true
    }),
    __metadata("design:type", Array)
], VideoChannelModel.prototype, "Videos", void 0);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoChannelModel, Object]),
    __metadata("design:returntype", Promise)
], VideoChannelModel, "sendDeleteIfOwned", null);
VideoChannelModel = VideoChannelModel_1 = __decorate([
    sequelize_typescript_1.DefaultScope({
        include: [
            {
                model: () => actor_1.ActorModel,
                required: true
            }
        ]
    }),
    sequelize_typescript_1.Scopes({
        [ScopeNames.AVAILABLE_FOR_LIST]: (options) => {
            const actorIdNumber = parseInt(options.actorId + '', 10);
            const inQueryInstanceFollow = '(' +
                'SELECT "actor"."serverId" FROM "actorFollow" ' +
                'INNER JOIN "actor" ON actor.id=  "actorFollow"."targetActorId" ' +
                'WHERE "actorFollow"."actorId" = ' + actorIdNumber +
                ')';
            return {
                include: [
                    {
                        attributes: {
                            exclude: actor_1.unusedActorAttributesForAPI
                        },
                        model: actor_1.ActorModel,
                        where: {
                            [sequelize_typescript_1.Sequelize.Op.or]: [
                                {
                                    serverId: null
                                },
                                {
                                    serverId: {
                                        [sequelize_typescript_1.Sequelize.Op.in]: sequelize_typescript_1.Sequelize.literal(inQueryInstanceFollow)
                                    }
                                }
                            ]
                        }
                    },
                    {
                        model: account_1.AccountModel,
                        required: true,
                        include: [
                            {
                                attributes: {
                                    exclude: actor_1.unusedActorAttributesForAPI
                                },
                                model: actor_1.ActorModel,
                                required: true
                            }
                        ]
                    }
                ]
            };
        },
        [ScopeNames.WITH_ACCOUNT]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    required: true
                }
            ]
        },
        [ScopeNames.WITH_VIDEOS]: {
            include: [
                () => video_1.VideoModel
            ]
        },
        [ScopeNames.WITH_ACTOR]: {
            include: [
                () => actor_1.ActorModel
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoChannel',
        indexes
    })
], VideoChannelModel);
exports.VideoChannelModel = VideoChannelModel;
//# sourceMappingURL=video-channel.js.map