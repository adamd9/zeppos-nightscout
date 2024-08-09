import {TEST_DATA} from "../../config/constants";

export class StatusData {
    constructor(isMgdl) {
        this.isMgdl = isMgdl;
    }

    getUnitText() {
        if (this.isMgdl == null) {
            return "";
        }
        if (this.isMgdl) {
            return "mg/dl";
        }
        return "mmol";
    }

    static createEmpty() {
        if (TEST_DATA){
            return new StatusData(true);
        }
        return new StatusData(null);
    }
}


//
// export const TREATMENT = {
//     insulin: 'insulin',
//     carbs: 'carbs',
//     timestamp: 'time',
// };
//
//