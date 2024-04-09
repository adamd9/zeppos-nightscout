import {
    Commands
} from "../config/constants";

import {
    NIGHTSCOUT_ALARM_SETTINGS_DEFAULTS,
} from "../config/global-constants";

const logger = DeviceRuntimeCore.HmLogger.getLogger("nightscout_app");

const {messageBuilder} = getApp()._options.globalData;

export class NightscoutRetriever {
    constructor() {
        this.lastInfoUpdate = null;
        this.lastUpdateSucessful = false; // This needs to be set somewhere in your logic
        // ... Additional properties as needed for your class
    }

    fetchInfo(callback) {
        logger.log("fetchInfoRetriever")

        this.resetLastUpdate();

        if (messageBuilder.connectStatus() === false) {
            logger.log("No BT Connection");
            if (isDisplay) {
                //this.showMessage(getText("status_no_bt"));
            } else {
            }
            return;
        }

        logger.log('building message')
        messageBuilder.request({
                method: Commands.getInfo
            }, { timeout: 5000 })
            .then((data) => {
                logger.log("retriever received data from side-service", data);
                let { result: info = {} } = data;

                try {
                    if (info.error) {
                        logger.log("Error");
                        logger.log(info);
                        return;
                    }

                    hmFS.SysProSetChars('fs_last_info', JSON.stringify(info))

                    let dataInfo = info;
                    // this.lastInfoUpdate = this.saveInfo(dataInfo); // Assume saveInfo is a method of the class
                    callback(info)
                } catch (e) {
                    logger.log("error:" + e);
                }
            })
            .catch((error) => {
                logger.log("fetch error:" + error);
            })
            .finally(() => {

            });
    }

    // Placeholder methods for those called within fetchInfo
    resetLastUpdate() {
        // implementation needed
    }



}
