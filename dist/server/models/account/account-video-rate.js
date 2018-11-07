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
var AccountVideoRateModel_1;
const lodash_1 = require("lodash");
const sequelize_typescript_1 = require("sequelize-typescript");
const initializers_1 = require("../../initializers");
const video_1 = require("../video/video");
const account_1 = require("./account");
const actor_1 = require("../activitypub/actor");
let AccountVideoRateModel = AccountVideoRateModel_1 = class AccountVideoRateModel extends sequelize_typescript_1.Model {
    static load(accountId, videoId, transaction) {
        const options = {
            where: {
                accountId,
                videoId
            }
        };
        if (transaction)
            options.transaction = transaction;
        return AccountVideoRateModel_1.findOne(options);
    }
    static listAndCountAccountUrlsByVideoId(rateType, videoId, start, count, t) {
        const query = {
            offset: start,
            limit: count,
            where: {
                videoId,
                type: rateType
            },
            transaction: t,
            include: [
                {
                    attributes: ['actorId'],
                    model: account_1.AccountModel.unscoped(),
                    required: true,
                    include: [
                        {
                            attributes: ['url'],
                            model: actor_1.ActorModel.unscoped(),
                            required: true
                        }
                    ]
                }
            ]
        };
        return AccountVideoRateModel_1.findAndCountAll(query);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.ENUM(lodash_1.values(initializers_1.VIDEO_RATE_TYPES))),
    __metadata("design:type", String)
], AccountVideoRateModel.prototype, "type", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], AccountVideoRateModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], AccountVideoRateModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], AccountVideoRateModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", video_1.VideoModel)
], AccountVideoRateModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], AccountVideoRateModel.prototype, "accountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", account_1.AccountModel)
], AccountVideoRateModel.prototype, "Account", void 0);
AccountVideoRateModel = AccountVideoRateModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'accountVideoRate',
        indexes: [
            {
                fields: ['videoId', 'accountId'],
                unique: true
            },
            {
                fields: ['videoId']
            },
            {
                fields: ['accountId']
            },
            {
                fields: ['videoId', 'type']
            }
        ]
    })
], AccountVideoRateModel);
exports.AccountVideoRateModel = AccountVideoRateModel;
