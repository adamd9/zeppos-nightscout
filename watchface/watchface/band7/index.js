import { BG_IMG, BG_FILL_RECT } from "../../utils/config/styles_global";
import { NIGHTSCOUT_APP_ID } from "../../utils/config/global-constants"
import {
  DIGITAL_TIME,
  DIGITAL_TIME_AOD,
  WEEK_DAYS_IMG,
  DATE_TEXT_IMG,
  IMG_STATUS_BT_DISCONNECTED,
  BG_VALUE_TEXT_IMG,
  BG_VALUE_TEXT_IMG_AOD,
  BG_TIME_TEXT,
  BG_TREND_IMAGE
} from "./styles";
import { str2json } from "../../shared/data";

const logger = getApp()._options.globalData.logger

let bgValTextImgWidget, bgValTimeTextWidget
let timerLastUpdated, currTime;

function mergeStyles(styleObj1, styleObj2, styleObj3 = {}) {
  return Object.assign({}, styleObj1, styleObj2, styleObj3);
}

WatchFace({

  onInit() {
    var self = this
    timerLastUpdated = Date.now()
    currTime = timerLastUpdated
    logger.log('Nightscout watchface index page.js on init invoke')
    const timer1 = timer.createTimer(
      0,
      1000,
      function () {
        currTime = Date.now()
        if (currTime - timerLastUpdated > 1200) {
          logger.log(`awoken! curr: ${currTime}, last: ${timerLastUpdated}, diff: ${currTime - timerLastUpdated}`);
          try {
            self.updateValues()
          } catch (error) {
            logger.log(error)
          }
        }
        timerLastUpdated = currTime

      },
    )


  },

  build() {
    logger.log('Nightscout watchface index page.js on build invoke')

    this.initView();

  },

  initView() {
    screenType = hmSetting.getScreenType();
    if (screenType === hmSetting.screen_type.AOD) {
      const digitalClock = hmUI.createWidget(hmUI.widget.IMG_TIME, mergeStyles(DIGITAL_TIME, DIGITAL_TIME_AOD));
    } else {
      const digitalClock = hmUI.createWidget(hmUI.widget.IMG_TIME, DIGITAL_TIME);
    };

    const daysImg = hmUI.createWidget(hmUI.widget.IMG_WEEK, WEEK_DAYS_IMG);
    const dateTextImg = hmUI.createWidget(hmUI.widget.IMG_DATE, DATE_TEXT_IMG);
    const btDisconnected = hmUI.createWidget(hmUI.widget.IMG_STATUS, IMG_STATUS_BT_DISCONNECTED);

    if (screenType === hmSetting.screen_type.AOD) {
      //removed mergstyles to see if it fixes
      bgValTextImgWidget = hmUI.createWidget(hmUI.widget.TEXT_IMG, BG_VALUE_TEXT_IMG_AOD);
    } else {
      bgValTextImgWidget = hmUI.createWidget(hmUI.widget.TEXT_IMG, BG_VALUE_TEXT_IMG);
    };

    //   if (screenType === hmSetting.screen_type.AOD) {
    //     logger.log("IS_AOD_TRUE");
    //     if (this.intervalTimer !== null) return; //already started

    //     const interval = 180000

    //     logger.log("startTimerDataUpdates, interval: " + interval);

    //     this.intervalTimer = this.getGlobal().setInterval(() => {
    //       logger.log("updating AOD")
    //         this.updateValues();
    //     }, interval);
    // }

    bgValTimeTextWidget = hmUI.createWidget(hmUI.widget.TEXT, BG_TIME_TEXT);

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 42,
      y: 280,
      w: 120,
      h: 40,
      radius: 12,
      normal_color: 0xfc6950,
      press_color: 0xfeb4a8,
      text: 'Refresh',
      show_level: hmUI.show_level.ONLY_NORMAL,
      click_func: () => {
        logger.log('Button pressed')
        hmApp.startApp({ appid: NIGHTSCOUT_APP_ID, url: 'page/wf-page', param: 'update' })
      }
    })
    bgTrendImageWidget = hmUI.createWidget(hmUI.widget.IMG, BG_TREND_IMAGE);

  },

  onDestroy() {
    logger.log('Nightscout watchface index page.js on destroy invoke')
  },

  updateValues() {
    logger.log('updating values')
    const fsLatestInfo = hmFS.SysProGetChars('fs_last_info')
    logger.log("got latest info from FS", fsLatestInfo)
    let dataInfo
    if (fsLatestInfo) {
      dataInfo = str2json(fsLatestInfo)
      logger.log('dataInfo', dataInfo)
    }
    if (dataInfo && !dataInfo.error) {
      bgValTextImgWidget.setProperty(hmUI.prop.VISIBLE, true)
      bgValTextImgWidget.setProperty(hmUI.prop.TEXT, dataInfo.bg.val)
      let bgTimeInMinutes;

      if (dataInfo && dataInfo.bg && typeof dataInfo.bg.time === 'number') {
        const currentTime = Date.now(); // Current time in milliseconds
        const differenceInMillis = currentTime - dataInfo.bg.time; // Difference in milliseconds

        // Convert milliseconds to minutes
        bgTimeInMinutes = Math.round(differenceInMillis / 60000);
      } else {
        // Handle cases where bg or bg.time is not available or not a valid timestamp
        console.error('Invalid or missing bg.time value')
      }

      bgValTimeTextWidget.setProperty(hmUI.prop.VISIBLE, true)
      bgValTimeTextWidget.setProperty(hmUI.prop.TEXT, bgTimeInMinutes.toString() + ' min')

      bgTrendImageWidget.setProperty(hmUI.prop.SRC, this.getArrowResource(dataInfo.bg.trend));
    } else {
      logger.log("latest info is an error", dataInfo)
      bgValTextImgWidget.setProperty(hmUI.prop.VISIBLE, true)
      bgValTextImgWidget.setProperty(hmUI.prop.TEXT, "...")

      bgTrendImageWidget.setProperty(hmUI.prop.SRC, "None");

      bgValTimeTextWidget.setProperty(hmUI.prop.VISIBLE, true)
      bgValTimeTextWidget.setProperty(hmUI.prop.TEXT, dataInfo.message)
    }
  },

  getArrowResource(trend) {
    let fileName = trend;
    if (fileName === undefined || fileName === "") {
      fileName = "None";
    }
    return `nightscout/arrows/${fileName}.png`;
  },

  onShow() {
    logger.log('index.js on show')
  },

  onHide() {
    logger.log('index.js on hide')
  },
})
