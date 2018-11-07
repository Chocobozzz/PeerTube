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
const sequelize_typescript_1 = require("sequelize-typescript");
const video_1 = require("../video/video");
const user_1 = require("./user");
let UserVideoHistoryModel = class UserVideoHistoryModel extends sequelize_typescript_1.Model {
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], UserVideoHistoryModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], UserVideoHistoryModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.IsInt,
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], UserVideoHistoryModel.prototype, "currentTime", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], UserVideoHistoryModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", video_1.VideoModel)
], UserVideoHistoryModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => user_1.UserModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], UserVideoHistoryModel.prototype, "userId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => user_1.UserModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", user_1.UserModel)
], UserVideoHistoryModel.prototype, "User", void 0);
UserVideoHistoryModel = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'userVideoHistory',
        indexes: [
            {
                fields: ['userId', 'videoId'],
                unique: true
            },
            {
                fields: ['userId']
            },
            {
                fields: ['videoId']
            }
        ]
    })
], UserVideoHistoryModel);
exports.UserVideoHistoryModel = UserVideoHistoryModel;
