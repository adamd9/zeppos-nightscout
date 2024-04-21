import {json2str} from "../shared/data";
import {DebugText} from "../shared/debug";
import {getGlobal} from "../shared/global";
import {gettext as getText} from "i18n";
import {
    Colors,
    Commands,
    DATA_STALE_TIME_MS,
    DATA_TIMER_UPDATE_INTERVAL_MS,
    DATA_UPDATE_INTERVAL_MS,
    PROGRESS_ANGLE_INC,
    PROGRESS_UPDATE_INTERVAL_MS,
    NIGHTSCOUT_UPDATE_INTERVAL_MS,
} from "../utils/config/constants";
import {
    NIGHTSCOUT_ALARM_SETTINGS_DEFAULTS, WF_DIR,
    WF_INFO_FILE,
} from "../utils/config/global-constants";
import {
    BG_DELTA_TEXT,
    BG_STALE_RECT,
    BG_TIME_TEXT,
    BG_TREND_IMAGE,
    BG_VALUE_TEXT,
    COMMON_BUTTON_SETTINGS,
    CONFIG_PAGE_SCROLL,
    DEVICE_TYPE,
    IMG_LOADING_PROGRESS,
    MESSAGE_TEXT,
    RADIO_OFF,
    RADIO_ON,
    TITLE_TEXT,
    VERSION_TEXT,
} from "../utils/config/styles";

import * as fs from "./../shared/fs";
import {WatchdripData} from "../utils/nightscout/nightscout-data";
import {getDataTypeConfig, img} from "../utils/helper";
import {gotoSubpage} from "../shared/navigate";
import {WatchdripConfig} from "../utils/nightscout/config";
import {Path} from "../utils/path";
import {NightscoutRetriever} from "../utils/nightscout/nightscout-retriever"

const logger = DeviceRuntimeCore.HmLogger.getLogger("nightscout_app");

const {messageBuilder} = getApp()._options.globalData;
const {appId} = hmApp.packageInfo();

/*
typeof DebugText
*/
var debug = null;
/*
typeof Watchdrip
*/
var nightscout = null;

const GoBackType = {NONE: 'none', GO_BACK: 'go_back', HIDE_PAGE: 'hide_page', HIDE: 'hide'};
const PagesType = {
    MAIN: 'main',
    UPDATE_LOCAL: 'update_local',
    CONFIG: 'config',
};
const FetchMode = {DISPLAY: 'display', HIDDEN: 'hidden'};

class Watchdrip {
    constructor() {

        this.createWatchdripDir();
        this.timeSensor = hmSensor.createSensor(hmSensor.id.TIME);
        this.vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE);
        this.globalNS = getGlobal();
        this.goBackType = GoBackType.NONE;

        this.lastInfoUpdate = 0;
        this.firstDisplay = true;
        this.lastUpdateAttempt = null;
        this.lastUpdateSucessful = false;
        this.updatingData = false;
        this.intervalTimer = null;
        this.updateIntervals = DATA_UPDATE_INTERVAL_MS;
        this.fetchMode = FetchMode.DISPLAY;
        this.conf = new WatchdripConfig();
        this.retriever = new NightscoutRetriever();

        debug.setEnabled(this.conf.settings.showLog);

        this.infoFile = new Path("full", WF_INFO_FILE);
    }

    start(data) {
        debug.log("start");
        debug.log(data);
        let pageTitle = '';
        this.goBackType = GoBackType.NONE;
        switch (data.page) {
            case PagesType.MAIN:
                let pkg = hmApp.packageInfo();
                pageTitle = pkg.name
                this.main_page();
                break;
            case PagesType.CONFIG:
                pageTitle = getText("settings");
                this.config_page();
                break;
        }

        if (pageTitle) {
            hmUI.updateStatusBarTitle(pageTitle);
        }
    }


    main_page() {
        hmSetting.setBrightScreen(60);
        hmApp.setScreenKeep(true);
        this.nightscoutData = new WatchdripData(this.timeSensor);
        let pkg = hmApp.packageInfo();
        this.versionTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {...VERSION_TEXT, text: "v" + pkg.version});
        this.messageTextWidget = hmUI.createWidget(hmUI.widget.TEXT, {...MESSAGE_TEXT, text: ""});
        this.bgValTextWidget = hmUI.createWidget(hmUI.widget.TEXT, BG_VALUE_TEXT);
        this.bgValTimeTextWidget = hmUI.createWidget(hmUI.widget.TEXT, BG_TIME_TEXT);
        this.bgDeltaTextWidget = hmUI.createWidget(hmUI.widget.TEXT, BG_DELTA_TEXT);
        this.bgTrendImageWidget = hmUI.createWidget(hmUI.widget.IMG, BG_TREND_IMAGE);
        this.bgStaleLine = hmUI.createWidget(hmUI.widget.FILL_RECT, BG_STALE_RECT);
        this.bgStaleLine.setProperty(hmUI.prop.VISIBLE, false);


        if (this.conf.settings.disableUpdates) {
            this.showMessage(getText("data_upd_disabled"));
        } else {
            if (this.readInfo()) {
                this.updateWidgets();
            }
            this.fetchInfo();
            this.startDataUpdates();
        }

  

        hmUI.createWidget(hmUI.widget.BUTTON, {
            ...COMMON_BUTTON_SETTINGS,
            click_func: (button_widget) => {
                logger.log("going to settings page")
                gotoSubpage(PagesType.CONFIG);
            },
        });
    }

    getConfigData() {
        let dataList = [];

        Object.entries(this.conf.settings).forEach(entry => {
            const [key, value] = entry;
            let stateImg = RADIO_OFF
            if (value) {
                stateImg = RADIO_ON
            }
            dataList.push({
                key: key,
                name: getText(key),
                state_src: img('icons/' + stateImg)
            });
        });
        this.configDataList = dataList;

        let dataTypeConfig = [
            getDataTypeConfig(1, 0, dataList.length)
        ]
        return {
            data_array: dataList,
            data_count: dataList.length,
            data_type_config: dataTypeConfig,
            data_type_config_count: dataTypeConfig.length
        }
    }

    config_page() {
        hmUI.setLayerScrolling(false);

        this.configScrollList = hmUI.createWidget(hmUI.widget.SCROLL_LIST,
            {
                ...CONFIG_PAGE_SCROLL,
                item_click_func: (list, index) => {
                    debug.log(index);
                    const key = this.configDataList[index].key
                    let val = this.conf.settings[key]
                    this.conf.settings[key] = !val;
                    this.conf.settingsTime = this.timeSensor.utc; // upd settings time
                    //update list
                    this.configScrollList.setProperty(hmUI.prop.UPDATE_DATA, {
                        ...this.getConfigData(),
                        //Refresh the data and stay on the current page. If it is not set or set to 0, it will return to the top of the list.
                        on_page: 1
                    })
                },
                ...this.getConfigData()
            });
    }

    startDataUpdates() {
        if (this.intervalTimer != null) return; //already started
        debug.log("startDataUpdates");
        this.intervalTimer = this.globalNS.setInterval(() => {
            this.checkUpdates();
        }, DATA_TIMER_UPDATE_INTERVAL_MS);
    }

    stopDataUpdates() {
        if (this.intervalTimer !== null) {
            //debug.log("stopDataUpdates");
            this.globalNS.clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    isTimeout(time, timeout_ms) {
        if (!time) {
            return false;
        }
        return this.timeSensor.utc - time > timeout_ms;
    }

    handleRareCases() {
        let fetch = false;
        if (this.lastUpdateAttempt == null) {
            debug.log("initial fetch");
            fetch = true;
        } else if (this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
            debug.log("the side app not responding, force update again");
            fetch = true;
        }
        if (fetch) {
            this.fetchInfo();
        }
    }

    checkUpdates() {
        //debug.log("checkUpdates");
        this.updateTimesWidget();
        if (this.updatingData) {
            //debug.log("updatingData, return");
            return;
        }
        let lastInfoUpdate = this.readLastUpdate();
        if (!lastInfoUpdate) {
            this.handleRareCases();
        } else {
            if (this.lastUpdateSucessful) {
                if (this.lastInfoUpdate !== lastInfoUpdate) {
                    //update widgets because the data was modified outside the current scope
                    debug.log("update from remote");
                    this.readInfo();
                    this.lastInfoUpdate = lastInfoUpdate;
                    this.updateWidgets();
                    return;
                }
                if (this.isTimeout(lastInfoUpdate, this.updateIntervals)) {
                    debug.log("reached updateIntervals");
                    this.fetchInfo();
                    return;
                }
                const bgTimeOlder = this.isTimeout(this.nightscoutData.getBg().time, NIGHTSCOUT_UPDATE_INTERVAL_MS);
                const statusNowOlder = this.isTimeout(this.nightscoutData.getStatus().now, NIGHTSCOUT_UPDATE_INTERVAL_MS);
                if (bgTimeOlder || statusNowOlder) {
                    if (!this.isTimeout(this.lastUpdateAttempt, DATA_STALE_TIME_MS)) {
                        debug.log("wait DATA_STALE_TIME");
                        return;
                    }
                    debug.log("data older than sensor update interval");
                    this.fetchInfo();
                    return;
                }
                //data not modified from outside scope so nothing to do
                debug.log("data not modified");
            } else {
                this.handleRareCases();
            }
        }
    }

    fetch_page() {
        debug.log("fetch_page");

        hmUI.setStatusBarVisible(false);
        if (this.conf.settings.disableUpdates) {
            this.handleGoBack();
            return;
        }
        hmSetting.setBrightScreen(999);
        this.progressWidget = hmUI.createWidget(hmUI.widget.IMG, IMG_LOADING_PROGRESS);
        this.progressAngle = 0;
        this.stopLoader();
        this.fetchMode = FetchMode.HIDDEN;
        this.fetchInfo();
    }


    fetchInfo() {
        logger.log("fetchInfoApp");

        let isDisplay = true;
        this.resetLastUpdate();

        this.retriever.fetchInfo(this.retrieve_complete.bind(this));
    }

    retrieve_complete(data) {
        logger.log("index page data retrieved from retriever", data);

        try {
            if (data.error) {
                debug.log("Error");
                debug.log(data);
                this.showMessage("Error: " + data.message);
                return;
            }

            let dataInfo = data;
            this.lastInfoUpdate = this.saveInfo(data);
            data = null;
            this.nightscoutData.setData(dataInfo);
            this.nightscoutData.updateTimeDiff();
            dataInfo = null;

            this.updateWidgets();
        } catch (e) {
            debug.log("error:" + e);
        }  

        this.updatingData = false;
    }

    startLoader() {
        this.progressWidget.setProperty(hmUI.prop.VISIBLE, true);
        this.progressWidget.setProperty(hmUI.prop.MORE, {angle: this.progressAngle});
        this.progressTimer = this.globalNS.setInterval(() => {
            this.updateLoader();
        }, PROGRESS_UPDATE_INTERVAL_MS);
    }

    updateLoader() {
        this.progressAngle = this.progressAngle + PROGRESS_ANGLE_INC;
        if (this.progressAngle >= 360) this.progressAngle = 0;
        this.progressWidget.setProperty(hmUI.prop.MORE, {angle: this.progressAngle});
    }

    stopLoader() {
        if (this.progressTimer !== null) {
            this.globalNS.clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        this.progressWidget.setProperty(hmUI.prop.VISIBLE, false);
    }

    updateWidgets() {
        debug.log('updateWidgets');
        this.setMessageVisibility(false);
        this.setBgElementsVisibility(true);
        this.updateValuesWidget()
        this.updateTimesWidget()
    }

    updateValuesWidget() {
        let bgValColor = Colors.white;
        let bgObj = this.nightscoutData.getBg();
        if (bgObj.isHigh) {
            bgValColor = Colors.bgHigh;
        } else if (bgObj.isLow) {
            bgValColor = Colors.bgLow;
        }

        this.bgValTextWidget.setProperty(hmUI.prop.MORE, {
            text: bgObj.getBGVal(),
            color: bgValColor,
        });

        this.bgDeltaTextWidget.setProperty(hmUI.prop.MORE, {
            text: bgObj.delta + " " + this.nightscoutData.getStatus().getUnitText()
        });

        //debug.log(bgObj.getArrowResource());
        this.bgTrendImageWidget.setProperty(hmUI.prop.SRC, bgObj.getArrowResource());
        this.bgStaleLine.setProperty(hmUI.prop.VISIBLE, this.nightscoutData.isBgStale());
    }

    updateTimesWidget() {
        let bgObj = this.nightscoutData.getBg();
        this.bgValTimeTextWidget.setProperty(hmUI.prop.MORE, {
            text: this.nightscoutData.getTimeAgo(bgObj.time),
        });
    }

    showMessage(text) {
        this.setBgElementsVisibility(false);
        //use for autowrap
        //
        // let lay = hmUI.getTextLayout(text, {
        //     text_size: MESSAGE_TEXT_SIZE,
        //     text_width: MESSAGE_TEXT_WIDTH,
        //     wrapped: 1
        // });
        // debug.log(lay);
        this.messageTextWidget.setProperty(hmUI.prop.MORE, {text: text});
        this.setMessageVisibility(true);
    }

    setBgElementsVisibility(visibility) {
        this.bgValTextWidget.setProperty(hmUI.prop.VISIBLE, visibility);
        this.bgValTimeTextWidget.setProperty(hmUI.prop.VISIBLE, visibility);
        this.bgTrendImageWidget.setProperty(hmUI.prop.VISIBLE, visibility);
        this.bgStaleLine.setProperty(hmUI.prop.VISIBLE, visibility);
        this.bgDeltaTextWidget.setProperty(hmUI.prop.VISIBLE, visibility);
    }

    setMessageVisibility(visibility) {
        this.messageTextWidget.setProperty(hmUI.prop.VISIBLE, visibility);
    }

    readInfo() {
        let data = this.infoFile.fetchJSON();
        if (data) {
                debug.log("data was read");
                this.nightscoutData.setData(data);
                this.nightscoutData.timeDiff = 0;
            data = null;
            return true
        }
        return false;
    }

    readLastUpdate() {
        debug.log("readLastUpdate");
        this.conf.read();
        this.lastUpdateAttempt = this.conf.infoLastUpdAttempt;
        this.lastUpdateSucessful = this.conf.infoLastUpdSucess;

        return this.conf.infoLastUpd;
    }

    resetLastUpdate() {
        debug.log("resetLastUpdate");
        this.lastUpdateAttempt = this.timeSensor.utc;
        this.lastUpdateSucessful = false;
        this.conf.infoLastUpdAttempt = this.lastUpdateAttempt
        this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
    }

    createWatchdripDir() {
        let dir = new Path("full", WF_DIR);
        if (!dir.exists()) {
            dir.mkdir();
        }
    }

    saveInfo(info) {
        debug.log("saveInfo");
        this.infoFile.overrideWithText(info);
        this.lastUpdateSucessful = true;
        let time = this.timeSensor.utc;
        this.conf.infoLastUpd = time
        this.conf.infoLastUpdSucess = this.lastUpdateSucessful;
        return time;
    }

    handleGoBack() {
        hmApp.goBack();
    }


    vibrateNow() {
        this.vibrate.stop();
        this.vibrate.scene = 24;
        this.vibrate.start();
    }

    onDestroy() {
        //this.disableCurrentAlarm(); //do not stop alarm on destroy
        this.conf.save();
        this.stopDataUpdates();
        this.vibrate.stop();
        hmSetting.setBrightScreenCancel();
    }
}

Page({
    onInit(p) {
        try {
            debug = new DebugText();
            debug.setLines(20);
            console.log("page onInit");
            let data = {page: PagesType.MAIN};
            try {
                if (!(!p || p === 'undefined')) {
                    data = JSON.parse(p);
                }
            } catch (e) {
                data = {page: p}
            }

            nightscout = new Watchdrip()
            nightscout.start(data);
        } catch (e) {
            debug.log('LifeCycle Error ' + e)
            e && e.stack && e.stack.split(/\n/).forEach((i) => debug.log('error stack:' + i))
        }
    },
    build() {
        logger.debug("page build invoked");
    },
    onDestroy() {
        logger.debug("page onDestroy invoked");
        nightscout.onDestroy();
    },
});
