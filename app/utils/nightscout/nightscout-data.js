import {BgData} from "./model/bgData";
import {StatusData} from "./model/statusData";
import {MINUTE_IN_MS, niceTime} from "../../shared/date";

const BG_STALE_TIME_MS = 13 * MINUTE_IN_MS;

export class WatchdripData {
    constructor(timeSensor) {
        this.timeSensor = timeSensor;
        /** @var BgData $object */
        this.bg = BgData.createEmpty();
        /** @var StatusData $object */
        this.status = StatusData.createEmpty();
    }

    setData(data) {
        if (data['bg'] === undefined) {
            this.bg = BgData.createEmpty();
        } else {
            this.bg = Object.assign(BgData.prototype, data['bg']);
        }

        if (data['status'] === undefined) {
            this.status = StatusData.createEmpty();
        } else {
            this.status = Object.assign(StatusData.prototype, data['status']);
        }
    }

    /** @return BgData $object */
    getBg() {
        return this.bg;
    }

    /** @return StatusData $object */
    getStatus() {
        return this.status;
    }

    isBgStale() {
        if (this.getBg().isHasData()) {
            return this.getBg().isStale;
        } else {
            return false;
        }
    }
}