"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractScheduler {
    enable() {
        if (!this.schedulerIntervalMs)
            throw new Error('Interval is not correctly set.');
        this.interval = setInterval(() => this.execute(), this.schedulerIntervalMs);
    }
    disable() {
        clearInterval(this.interval);
    }
}
exports.AbstractScheduler = AbstractScheduler;
//# sourceMappingURL=abstract-scheduler.js.map