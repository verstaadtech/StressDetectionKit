import remotedev from 'mobx-remotedev';
import { observable, action } from 'mobx';
import {
  Accelerometer,
  Gyroscope,
  SensorData,
  SensorObservable
} from 'react-native-sensors';
import { Device, Reading } from 'lib/device-kit';
import DeviceKit from 'lib/device-kit';

type StressLevels = 'low' | 'medium' | 'high';

interface StressMark {
  timestamp: number;
  level: StressLevels;
}

@remotedev
export default class Main {
  @observable initialized = false;
  @observable collecting = false;
  @observable scanning = false;
  @observable.shallow devices: Device[] = [];
  @observable.ref currentDevice?: Device;
  @observable.shallow readings: Reading[] = [];
  @observable.shallow accelerometerData: SensorData[] = [];
  @observable.shallow gyroscopeData: SensorData[] = [];
  @observable.shallow stressMarks: StressMark[] = [];

  private accelerometer: SensorObservable;
  private gyroscope: SensorObservable;

  constructor(private sdk: DeviceKit) {}

  initialize(key: string) {
    this.sdk
      .register(key)
      .then(() => this.sdk.fetchDevices())
      .then(
        action('initialize', (devices: Device[]) => {
          this.initialized = true;

          if (devices[0]) {
            this.currentDevice = devices[0];
          }
        })
      );
  }

  @action
  startCollection() {
    if (this.collecting) return;

    this.collecting = true;

    this.sdk.on('data', r => this.addReading(r));
    this.sdk.startCollection();

    Gyroscope({ updateInterval: 500 })
      .then(observable => {
        this.gyroscope = observable;

        this.gyroscope.subscribe(
          action('addGyroscopeData', (d: SensorData) => {
            this.gyroscopeData.push(d);
          })
        );
      })
      .catch(error => {
        console.error(error);
      });

    Accelerometer({ updateInterval: 500 })
      .then(observable => {
        this.accelerometer = observable;

        this.accelerometer.subscribe(
          action('addAccelerometerData', (d: SensorData) => {
            this.accelerometerData.push(d);
          })
        );
      })
      .catch(error => {
        console.error(error);
      });
  }

  @action
  addReading(reading: Reading) {
    this.readings.push(reading);
  }

  @action
  stopCollection() {
    if (!this.collecting) return;

    this.collecting = false;
    this.sdk.stopCollection();
    this.accelerometer.stop();
    this.gyroscope.stop();
  }

  @action
  startScan() {
    if (this.scanning) return;

    this.sdk.on('deviceFound', d => this.addDevice(d));
    this.sdk.startScan();
    this.scanning = true;
  }

  @action
  stopScan() {
    if (!this.scanning) return;

    this.sdk.removeAllListeners('deviceFound');
    this.sdk.stopScan();
    this.scanning = false;
  }

  restartScan() {
    this.stopScan();
    this.startScan();
  }

  @action
  addDevice(device: Device) {
    if (!this.devices.find(d => d.id === device.id)) {
      this.devices.push(device);
    }
  }

  setDevice(device: Device | number) {
    if (this.currentDevice) {
      this.sdk.removeDevice(this.currentDevice);
    }

    let newDevice =
      typeof device === 'number'
        ? this.devices.find(d => d.id === device)
        : device;

    if (newDevice) {
      this.sdk.addDevice(newDevice).then(
        action('setDevice', () => {
          this.devices = this.devices.filter(d => d.id !== newDevice!.id);
          this.currentDevice = newDevice;
        })
      );
    }
  }

  @action
  removeDevice() {
    if (this.currentDevice) {
      this.sdk.removeDevice(this.currentDevice);
      this.currentDevice = undefined;
    }
  }

  @action
  addStressMark(level: StressLevels) {
    this.stressMarks.push({ level, timestamp: Date.now() });
  }
}