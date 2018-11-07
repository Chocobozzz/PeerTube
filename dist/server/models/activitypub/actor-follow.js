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
var ActorFollowModel_1;
const lodash_1 = require("lodash");
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const logger_1 = require("../../helpers/logger");
const utils_1 = require("../../helpers/utils");
const initializers_1 = require("../../initializers");
const constants_1 = require("../../initializers/constants");
const server_1 = require("../server/server");
const utils_2 = require("../utils");
const actor_1 = require("./actor");
const video_channel_1 = require("../video/video-channel");
const account_1 = require("../account/account");
let ActorFollowModel = ActorFollowModel_1 = class ActorFollowModel extends sequelize_typescript_1.Model {
    static incrementFollowerAndFollowingCount(instance) {
        if (instance.state !== 'accepted')
            return undefined;
        return Promise.all([
            actor_1.ActorModel.incrementFollows(instance.actorId, 'followingCount', 1),
            actor_1.ActorModel.incrementFollows(instance.targetActorId, 'followersCount', 1)
        ]);
    }
    static decrementFollowerAndFollowingCount(instance) {
        return Promise.all([
            actor_1.ActorModel.incrementFollows(instance.actorId, 'followingCount', -1),
            actor_1.ActorModel.incrementFollows(instance.targetActorId, 'followersCount', -1)
        ]);
    }
    static removeBadActorFollows() {
        return __awaiter(this, void 0, void 0, function* () {
            const actorFollows = yield ActorFollowModel_1.listBadActorFollows();
            const actorFollowsRemovePromises = actorFollows.map(actorFollow => actorFollow.destroy());
            yield Promise.all(actorFollowsRemovePromises);
            const numberOfActorFollowsRemoved = actorFollows.length;
            if (numberOfActorFollowsRemoved)
                logger_1.logger.info('Removed bad %d actor follows.', numberOfActorFollowsRemoved);
        });
    }
    static updateActorFollowsScore(goodInboxes, badInboxes, t) {
        if (goodInboxes.length === 0 && badInboxes.length === 0)
            return;
        logger_1.logger.info('Updating %d good actor follows and %d bad actor follows scores.', goodInboxes.length, badInboxes.length);
        if (goodInboxes.length !== 0) {
            ActorFollowModel_1.incrementScores(goodInboxes, initializers_1.ACTOR_FOLLOW_SCORE.BONUS, t)
                .catch(err => logger_1.logger.error('Cannot increment scores of good actor follows.', { err }));
        }
        if (badInboxes.length !== 0) {
            ActorFollowModel_1.incrementScores(badInboxes, initializers_1.ACTOR_FOLLOW_SCORE.PENALTY, t)
                .catch(err => logger_1.logger.error('Cannot decrement scores of bad actor follows.', { err }));
        }
    }
    static loadByActorAndTarget(actorId, targetActorId, t) {
        const query = {
            where: {
                actorId,
                targetActorId: targetActorId
            },
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    as: 'ActorFollower'
                },
                {
                    model: actor_1.ActorModel,
                    required: true,
                    as: 'ActorFollowing'
                }
            ],
            transaction: t
        };
        return ActorFollowModel_1.findOne(query);
    }
    static loadByActorAndTargetNameAndHostForAPI(actorId, targetName, targetHost, t) {
        const actorFollowingPartInclude = {
            model: actor_1.ActorModel,
            required: true,
            as: 'ActorFollowing',
            where: {
                preferredUsername: targetName
            },
            include: [
                {
                    model: video_channel_1.VideoChannelModel.unscoped(),
                    required: false
                }
            ]
        };
        if (targetHost === null) {
            actorFollowingPartInclude.where['serverId'] = null;
        }
        else {
            actorFollowingPartInclude.include.push({
                model: server_1.ServerModel,
                required: true,
                where: {
                    host: targetHost
                }
            });
        }
        const query = {
            where: {
                actorId
            },
            include: [
                actorFollowingPartInclude,
                {
                    model: actor_1.ActorModel,
                    required: true,
                    as: 'ActorFollower'
                }
            ],
            transaction: t
        };
        return ActorFollowModel_1.findOne(query)
            .then(result => {
            if (result && result.ActorFollowing.VideoChannel) {
                result.ActorFollowing.VideoChannel.Actor = result.ActorFollowing;
            }
            return result;
        });
    }
    static listSubscribedIn(actorId, targets) {
        const whereTab = targets
            .map(t => {
            if (t.host) {
                return {
                    [Sequelize.Op.and]: [
                        {
                            '$preferredUsername$': t.name
                        },
                        {
                            '$host$': t.host
                        }
                    ]
                };
            }
            return {
                [Sequelize.Op.and]: [
                    {
                        '$preferredUsername$': t.name
                    },
                    {
                        '$serverId$': null
                    }
                ]
            };
        });
        const query = {
            attributes: [],
            where: {
                [Sequelize.Op.and]: [
                    {
                        [Sequelize.Op.or]: whereTab
                    },
                    {
                        actorId
                    }
                ]
            },
            include: [
                {
                    attributes: ['preferredUsername'],
                    model: actor_1.ActorModel.unscoped(),
                    required: true,
                    as: 'ActorFollowing',
                    include: [
                        {
                            attributes: ['host'],
                            model: server_1.ServerModel.unscoped(),
                            required: false
                        }
                    ]
                }
            ]
        };
        return ActorFollowModel_1.findAll(query);
    }
    static listFollowingForApi(id, start, count, sort, search) {
        const query = {
            distinct: true,
            offset: start,
            limit: count,
            order: utils_2.getSort(sort),
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    as: 'ActorFollower',
                    where: {
                        id
                    }
                },
                {
                    model: actor_1.ActorModel,
                    as: 'ActorFollowing',
                    required: true,
                    include: [
                        {
                            model: server_1.ServerModel,
                            required: true,
                            where: search ? {
                                host: {
                                    [Sequelize.Op.iLike]: '%' + search + '%'
                                }
                            } : undefined
                        }
                    ]
                }
            ]
        };
        return ActorFollowModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    static listFollowersForApi(id, start, count, sort, search) {
        const query = {
            distinct: true,
            offset: start,
            limit: count,
            order: utils_2.getSort(sort),
            include: [
                {
                    model: actor_1.ActorModel,
                    required: true,
                    as: 'ActorFollower',
                    include: [
                        {
                            model: server_1.ServerModel,
                            required: true,
                            where: search ? {
                                host: {
                                    [Sequelize.Op.iLike]: '%' + search + '%'
                                }
                            } : undefined
                        }
                    ]
                },
                {
                    model: actor_1.ActorModel,
                    as: 'ActorFollowing',
                    required: true,
                    where: {
                        id
                    }
                }
            ]
        };
        return ActorFollowModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    static listSubscriptionsForApi(id, start, count, sort) {
        const query = {
            attributes: [],
            distinct: true,
            offset: start,
            limit: count,
            order: utils_2.getSort(sort),
            where: {
                actorId: id
            },
            include: [
                {
                    attributes: ['id'],
                    model: actor_1.ActorModel.unscoped(),
                    as: 'ActorFollowing',
                    required: true,
                    include: [
                        {
                            model: video_channel_1.VideoChannelModel.unscoped(),
                            required: true,
                            include: [
                                {
                                    attributes: {
                                        exclude: actor_1.unusedActorAttributesForAPI
                                    },
                                    model: actor_1.ActorModel,
                                    required: true
                                },
                                {
                                    model: account_1.AccountModel.unscoped(),
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
                        }
                    ]
                }
            ]
        };
        return ActorFollowModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows.map(r => r.ActorFollowing.VideoChannel),
                total: count
            };
        });
    }
    static listAcceptedFollowerUrlsForApi(actorIds, t, start, count) {
        return ActorFollowModel_1.createListAcceptedFollowForApiQuery('followers', actorIds, t, start, count);
    }
    static listAcceptedFollowerSharedInboxUrls(actorIds, t) {
        return ActorFollowModel_1.createListAcceptedFollowForApiQuery('followers', actorIds, t, undefined, undefined, 'sharedInboxUrl', true);
    }
    static listAcceptedFollowingUrlsForApi(actorIds, t, start, count) {
        return ActorFollowModel_1.createListAcceptedFollowForApiQuery('following', actorIds, t, start, count);
    }
    static getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const serverActor = yield utils_1.getServerActor();
            const totalInstanceFollowing = yield ActorFollowModel_1.count({
                where: {
                    actorId: serverActor.id
                }
            });
            const totalInstanceFollowers = yield ActorFollowModel_1.count({
                where: {
                    targetActorId: serverActor.id
                }
            });
            return {
                totalInstanceFollowing,
                totalInstanceFollowers
            };
        });
    }
    static createListAcceptedFollowForApiQuery(type, actorIds, t, start, count, columnUrl = 'url', distinct = false) {
        return __awaiter(this, void 0, void 0, function* () {
            let firstJoin;
            let secondJoin;
            if (type === 'followers') {
                firstJoin = 'targetActorId';
                secondJoin = 'actorId';
            }
            else {
                firstJoin = 'actorId';
                secondJoin = 'targetActorId';
            }
            const selections = [];
            if (distinct === true)
                selections.push('DISTINCT("Follows"."' + columnUrl + '") AS "url"');
            else
                selections.push('"Follows"."' + columnUrl + '" AS "url"');
            selections.push('COUNT(*) AS "total"');
            const tasks = [];
            for (let selection of selections) {
                let query = 'SELECT ' + selection + ' FROM "actor" ' +
                    'INNER JOIN "actorFollow" ON "actorFollow"."' + firstJoin + '" = "actor"."id" ' +
                    'INNER JOIN "actor" AS "Follows" ON "actorFollow"."' + secondJoin + '" = "Follows"."id" ' +
                    'WHERE "actor"."id" = ANY ($actorIds) AND "actorFollow"."state" = \'accepted\' ';
                if (count !== undefined)
                    query += 'LIMIT ' + count;
                if (start !== undefined)
                    query += ' OFFSET ' + start;
                const options = {
                    bind: { actorIds },
                    type: Sequelize.QueryTypes.SELECT,
                    transaction: t
                };
                tasks.push(ActorFollowModel_1.sequelize.query(query, options));
            }
            const [followers, [{ total }]] = yield Promise.all(tasks);
            const urls = followers.map(f => f.url);
            return {
                data: urls,
                total: parseInt(total, 10)
            };
        });
    }
    static incrementScores(inboxUrls, value, t) {
        const inboxUrlsString = inboxUrls.map(url => `'${url}'`).join(',');
        const query = `UPDATE "actorFollow" SET "score" = LEAST("score" + ${value}, ${initializers_1.ACTOR_FOLLOW_SCORE.MAX}) ` +
            'WHERE id IN (' +
            'SELECT "actorFollow"."id" FROM "actorFollow" ' +
            'INNER JOIN "actor" ON "actor"."id" = "actorFollow"."actorId" ' +
            'WHERE "actor"."inboxUrl" IN (' + inboxUrlsString + ') OR "actor"."sharedInboxUrl" IN (' + inboxUrlsString + ')' +
            ')';
        const options = t ? {
            type: Sequelize.QueryTypes.BULKUPDATE,
            transaction: t
        } : undefined;
        return ActorFollowModel_1.sequelize.query(query, options);
    }
    static listBadActorFollows() {
        const query = {
            where: {
                score: {
                    [Sequelize.Op.lte]: 0
                }
            },
            logging: false
        };
        return ActorFollowModel_1.findAll(query);
    }
    toFormattedJSON() {
        const follower = this.ActorFollower.toFormattedJSON();
        const following = this.ActorFollowing.toFormattedJSON();
        return {
            id: this.id,
            follower,
            following,
            score: this.score,
            state: this.state,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ENUM(lodash_1.values(constants_1.FOLLOW_STATES))),
    __metadata("design:type", String)
], ActorFollowModel.prototype, "state", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Default(initializers_1.ACTOR_FOLLOW_SCORE.BASE),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Max(initializers_1.ACTOR_FOLLOW_SCORE.MAX),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorFollowModel.prototype, "score", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], ActorFollowModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], ActorFollowModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => actor_1.ActorModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorFollowModel.prototype, "actorId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => actor_1.ActorModel, {
        foreignKey: {
            name: 'actorId',
            allowNull: false
        },
        as: 'ActorFollower',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", actor_1.ActorModel)
], ActorFollowModel.prototype, "ActorFollower", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => actor_1.ActorModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], ActorFollowModel.prototype, "targetActorId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => actor_1.ActorModel, {
        foreignKey: {
            name: 'targetActorId',
            allowNull: false
        },
        as: 'ActorFollowing',
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", actor_1.ActorModel)
], ActorFollowModel.prototype, "ActorFollowing", void 0);
__decorate([
    sequelize_typescript_1.AfterCreate,
    sequelize_typescript_1.AfterUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ActorFollowModel]),
    __metadata("design:returntype", void 0)
], ActorFollowModel, "incrementFollowerAndFollowingCount", null);
__decorate([
    sequelize_typescript_1.AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ActorFollowModel]),
    __metadata("design:returntype", void 0)
], ActorFollowModel, "decrementFollowerAndFollowingCount", null);
ActorFollowModel = ActorFollowModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'actorFollow',
        indexes: [
            {
                fields: ['actorId']
            },
            {
                fields: ['targetActorId']
            },
            {
                fields: ['actorId', 'targetActorId'],
                unique: true
            },
            {
                fields: ['score']
            }
        ]
    })
], ActorFollowModel);
exports.ActorFollowModel = ActorFollowModel;
//# sourceMappingURL=actor-follow.js.map