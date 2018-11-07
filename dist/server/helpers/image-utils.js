"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("multer");
const sharp = require("sharp");
const fs_extra_1 = require("fs-extra");
function processImage(physicalFile, destination, newSize) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sharp(physicalFile.path)
            .resize(newSize.width, newSize.height)
            .toFile(destination);
        yield fs_extra_1.remove(physicalFile.path);
    });
}
exports.processImage = processImage;
//# sourceMappingURL=image-utils.js.map