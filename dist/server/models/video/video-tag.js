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
const tag_1 = require("./tag");
const video_1 = require("./video");
let VideoTagModel = class VideoTagModel extends sequelize_typescript_1.Model {
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoTagModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoTagModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoTagModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => tag_1.TagModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoTagModel.prototype, "tagId", void 0);
VideoTagModel = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'videoTag',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['tagId']
            }
        ]
    })
], VideoTagModel);
exports.VideoTagModel = VideoTagModel;
