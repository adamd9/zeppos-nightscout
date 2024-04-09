import {DebugText} from "../shared/debug";
import {getGlobal} from "../shared/global";
import {
    DATA_STALE_TIME_MS,
    DATA_UPDATE_INTERVAL_MS
} from "../utils/config/constants";

import {WatchdripConfig} from "../utils/nightscout/config";
import {NightscoutRetriever} from "../utils/nightscout/nightscout-retriever"

const logger = DeviceRuntimeCore.HmLogger.getLogger("nightscout_app");

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
    UPDATE: 'update',
    UPDATE_LOCAL: 'update_local',
    HIDE: 'hide',
    CONFIG: 'config',
    ADD_TREATMENT: 'add_treatment'
};
const FetchMode = {DISPLAY: 'display', HIDDEN: 'hidden'};

class Watchdrip {
    constructor() {

        this.timeSensor = hmSensor.createSensor(hmSensor.id.TIME);
        this.vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE);
        this.globalNS = getGlobal();
        this.goBackType = GoBackType.NONE;

        this.system_alarm_id = null;
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

    }

    start(data) {
        debug.log("start");
        debug.log(data);
        this.conf.alarmSettings = {...this.conf.alarmSettings, ...data.params};
        this.prepareNextAlarm()
        this.retriever.fetchInfo(this.retrieve_complete.bind(this));
    }

    retrieve_complete(info) {
        if (info && info.settings && info.settings.updateInterval && 
            info.settings.updateInterval !== this.conf.alarmSettings.fetchInterval / 60) {
                logger.log("Update interval (minutes) setting updated from app settings:", info.settings.updateInterval + " minutes")
                this.conf.alarmSettings.fetchInterval = info.settings.updateInterval * 60
            }
        this.hide_page();
    }

    isTimeout(time, timeout_ms) {
        if (!time) {
            return false;
        }
        return this.timeSensor.utc - time > timeout_ms;
    }

    hide_page() {
        hmApp.setScreenKeep(false);
        //hmSetting.setBrightScreenCancel();
        hmSetting.setBrightScreen(1)
        hmSetting.setScreenOff();
        //hmApp.goBack();
        //hmApp.exit();
        hmApp.gotoHome();
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

    saveAlarmId(alarm_id) {
        debug.log("saveAlarmId");
        this.conf.alarm_id = alarm_id;
    }

    disableCurrentAlarm() {
        debug.log("disableCurrentAlarm");
        const alarm_id = this.conf.alarm_id; //read saved alarm to disable
        if (alarm_id && alarm_id !== -1) {
            debug.log("stop old app alarm");
            hmApp.alarmCancel(alarm_id);
            this.saveAlarmId('-1');
        }
    }

    prepareNextAlarm() {
        this.disableCurrentAlarm();
        if (this.conf.settings.disableUpdates) {
            if (this.system_alarm_id !== null) {
                hmApp.alarmCancel(this.system_alarm_id);
            }
            return;
        }
        debug.log("Next alarm in " + this.conf.alarmSettings.fetchInterval + "s");
        if (this.system_alarm_id == null) {
            this.system_alarm_id = hmApp.alarmNew({
                appid: appId,
                url: "page/wf-page",
                param: PagesType.UPDATE_LOCAL,
                delay: this.conf.alarmSettings.fetchInterval,
            });
            this.saveAlarmId(this.system_alarm_id);
        }
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
