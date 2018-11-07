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
var VideoChangeOwnershipModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const account_1 = require("../account/account");
const video_1 = require("./video");
const videos_1 = require("../../../shared/models/videos");
const utils_1 = require("../utils");
const video_file_1 = require("./video-file");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["FULL"] = "FULL";
})(ScopeNames || (ScopeNames = {}));
let VideoChangeOwnershipModel = VideoChangeOwnershipModel_1 = class VideoChangeOwnershipModel extends sequelize_typescript_1.Model {
    static listForApi(nextOwnerId, start, count, sort) {
        const query = {
            offset: start,
            limit: count,
            order: utils_1.getSort(sort),
            where: {
                nextOwnerAccountId: nextOwnerId
            }
        };
        return VideoChangeOwnershipModel_1.scope(ScopeNames.FULL).findAndCountAll(query)
            .then(({ rows, count }) => ({ total: count, data: rows }));
    }
    static load(id) {
        return VideoChangeOwnershipModel_1.scope(ScopeNames.FULL).findById(id);
    }
    toFormattedJSON() {
        return {
            id: this.id,
            status: this.status,
            initiatorAccount: this.Initiator.toFormattedJSON(),
            nextOwnerAccount: this.NextOwner.toFormattedJSON(),
            video: {
                id: this.Video.id,
                uuid: this.Video.uuid,
                url: this.Video.url,
                name: this.Video.name
            },
            createdAt: this.createdAt
        };
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoChangeOwnershipModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoChangeOwnershipModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoChangeOwnershipModel.prototype, "status", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoChangeOwnershipModel.prototype, "initiatorAccountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            name: 'initiatorAccountId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", account_1.AccountModel)
], VideoChangeOwnershipModel.prototype, "Initiator", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => account_1.AccountModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoChangeOwnershipModel.prototype, "nextOwnerAccountId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => account_1.AccountModel, {
        foreignKey: {
            name: 'nextOwnerAccountId',
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", account_1.AccountModel)
], VideoChangeOwnershipModel.prototype, "NextOwner", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoChangeOwnershipModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoChangeOwnershipModel.prototype, "Video", void 0);
VideoChangeOwnershipModel = VideoChangeOwnershipModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'videoChangeOwnership',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['initiatorAccountId']
            },
            {
                fields: ['nextOwnerAccountId']
            }
        ]
    }),
    sequelize_typescript_1.Scopes({
        [ScopeNames.FULL]: {
            include: [
                {
                    model: () => account_1.AccountModel,
                    as: 'Initiator',
                    required: true
                },
                {
                    model: () => account_1.AccountModel,
                    as: 'NextOwner',
                    required: true
                },
                {
                    model: () => video_1.VideoModel,
                    required: true,
                    include: [
                        { model: () => video_file_1.VideoFileModel }
                    ]
                }
            ]
        }
    })
], VideoChangeOwnershipModel);
exports.VideoChangeOwnershipModel = VideoChangeOwnershipModel;
//# sourceMappingURL=video-change-ownership.js.map