// settings.js
import { gettext } from 'i18n';

const DEFAULT_SETTINGS = {
  urlConfig: '',
  accessToken: '',
  updateInterval: 60 // Default interval in minutes
};

AppSettingsPage({
  state: {
    settings: {}
  },
  // Initialize settings with default or stored values
  initSettings() {
    this.state.settings = {
      urlConfig: this.getUrlConfig(),
      accessToken: this.getAccessToken(),
      updateInterval: this.getUpdateInterval()
    };
  },
  // Retrieve URL Configuration from storage or use default
  getUrlConfig() {
    const storedUrlConfig = this.state.props.settingsStorage.getItem('urlConfig');
    return storedUrlConfig ? JSON.parse(storedUrlConfig) : DEFAULT_SETTINGS.urlConfig;
  },
  // Retrieve URL Configuration from storage or use default
  getAccessToken() {
    const storedAccessToken = this.state.props.settingsStorage.getItem('accessToken');
    return storedAccessToken ? JSON.parse(storedAccessToken) : DEFAULT_SETTINGS.accessToken;
  },
  // Update URL Configuration
  setUrlConfig(value) {
    this.state.settings.urlConfig = value;
    this.state.props.settingsStorage.setItem('urlConfig', JSON.stringify(value));
  },
  // Update access token Configuration
  setAccessToken(value) {
    this.state.settings.accessToken = value;
    this.state.props.settingsStorage.setItem('accessToken', JSON.stringify(value));
  },  
  // Retrieve Update Interval from storage or use default
  getUpdateInterval() {
    const storedUpdateInterval = this.state.props.settingsStorage.getItem('updateInterval');
    return storedUpdateInterval ? JSON.parse(storedUpdateInterval) : DEFAULT_SETTINGS.updateInterval;
  },
  // Update Update Interval
  setUpdateInterval(value) {
    this.state.settings.updateInterval = value;
    this.state.props.settingsStorage.setItem('updateInterval', JSON.stringify(value));
  },
  // Component initialization
  build(props) {
    this.state.props = props;
    this.initSettings();

    return View(
      {
        style: {
          padding: '12px 20px'
        }
      },
      [
        Text({
          style: {
            paddingBottom: "20px",
            fontWeight: "bold",
            fontSize: "20px"
          }
        },"Nightscout Settings"),
        Text({
          paragraph: true,
          style: {
            paddingBottom: "20px",
          }
        },"Tap a setting to change it"),
        TextInput({
          label: gettext('URL Configuration'),
          value: this.state.settings.urlConfig,
          labelStyle: {
            fontWeight: "bold"
          },
          subStyle: {
            textDecoration: "underline",
            marginBottom: "10px",
            padding: "5px",
            margin: "5px",
            border: "1px solid #cccccc",
            borderRadius: "5px"
          },
          onChange: (val) => {
            this.setUrlConfig(val);
          }
        }),
        TextInput({
          label: gettext('Access token'),
          value: this.state.settings.accessToken,
          labelStyle: {
            fontWeight: "bold"
          },
          subStyle: {
            textDecoration: "underline",
            marginBottom: "10px",
            padding: "5px",
            margin: "5px",
            border: "1px solid #cccccc",
            borderRadius: "5px"
          },
          onChange: (val) => {
            this.setAccessToken(val);
          }
        }),        
        TextInput({
          label: gettext('Update Interval (minutes)'),
          value: String(this.state.settings.updateInterval),
          labelStyle: {
            fontWeight: "bold"
          },
          subStyle: {
            textDecoration: "underline",
            marginBottom: "10px",
            padding: "5px",
            margin: "5px",
            border: "1px solid #cccccc",
            borderRadius: "5px"
          },
          onChange: (val) => {
            const interval = parseInt(val, 10);
            if (!isNaN(interval) && interval > 0) {
              this.setUpdateInterval(interval);
            } else {
              console.log("Invalid interval. It must be a positive number.");
            }
          }
        })
      ]
    );
  }
});
