import { Platform, PermissionsAndroid } from 'react-native';
import BleManager, {
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  Peripheral,
} from 'react-native-ble-manager';

const SECONDS_TO_SCAN_FOR = 7;
const SERVICE_UUIDS: string[] = [];
const ALLOW_DUPLICATES = true;
declare module 'react-native-ble-manager' {
  // enrich local contract with custom state properties needed by App.tsx
  interface Peripheral {
    connected?: boolean;
    connecting?: boolean;
  }
}

export const addOrUpdatePeripheral = (
  id: string,
  updatedPeripheral: Peripheral,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  // new Map() enables changing the reference & refreshing UI.
  // TOFIX not efficient.
  setPeripherals(map => new Map(map.set(id, updatedPeripheral)));
};

export const startScan = (
  isScanning: boolean,
  setIsScanning: React.Dispatch<React.SetStateAction<boolean>>,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  if (!isScanning) {
    // reset found peripherals before scan
    setPeripherals(new Map<Peripheral['id'], Peripheral>());

    try {
      console.debug('[startScan] starting scan...');
      setIsScanning(true);
      BleManager.scan(SERVICE_UUIDS, SECONDS_TO_SCAN_FOR, ALLOW_DUPLICATES, {
        matchMode: BleScanMatchMode.Sticky,
        scanMode: BleScanMode.LowLatency,
        callbackType: BleScanCallbackType.AllMatches,
      })
        .then(() => {
          console.debug('[startScan] scan promise returned successfully.');
        })
        .catch(err => {
          console.error('[startScan] ble scan returned in error', err);
        });
    } catch (error) {
      console.error('[startScan] ble scan error thrown', error);
    }
  }
};

export const handleStopScan = (
  setIsScanning: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  setIsScanning(false);
  console.debug('[handleStopScan] scan is stopped.');
};

export const handleDisconnectedPeripheral = (
  event: BleDisconnectPeripheralEvent,
  peripherals: Map<string, Peripheral>,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  let peripheral = peripherals.get(event.peripheral);
  if (peripheral) {
    console.debug(
      `[handleDisconnectedPeripheral][${peripheral.id}] previously connected peripheral is disconnected.`,
      event.peripheral,
    );
    addOrUpdatePeripheral(
      peripheral.id,
      { ...peripheral, connected: false },
      setPeripherals,
    );
  }
  console.debug(
    `[handleDisconnectedPeripheral][${event.peripheral}] disconnected.`,
  );
};

export const handleUpdateValueForCharacteristic = (
  data: BleManagerDidUpdateValueForCharacteristicEvent,
) => {
  console.debug(
    `[handleUpdateValueForCharacteristic] received data from '${data.peripheral}' with characteristic='${data.characteristic}' and value='${data.value}'`,
  );
};

export const handleDiscoverPeripheral = (
  peripheral: Peripheral,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  console.debug('[handleDiscoverPeripheral] new BLE peripheral=', peripheral);
  if (!peripheral.name) {
    peripheral.name = 'NO NAME';
  }
  addOrUpdatePeripheral(peripheral.id, peripheral, setPeripherals);
};

export const togglePeripheralConnection = async (
  peripheral: Peripheral,
  peripherals: Map<string, Peripheral>,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  if (peripheral && peripheral.connected) {
    try {
      await BleManager.disconnect(peripheral.id);
    } catch (error) {
      console.error(
        `[togglePeripheralConnection][${peripheral.id}] error when trying to disconnect device.`,
        error,
      );
    }
  } else {
    await connectPeripheral(peripheral, peripherals, setPeripherals);
  }
};

export const retrieveConnected = async (
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  try {
    const connectedPeripherals = await BleManager.getConnectedPeripherals();
    if (connectedPeripherals.length === 0) {
      console.warn('[retrieveConnected] No connected peripherals found.');
      return;
    }

    console.debug(
      '[retrieveConnected] connectedPeripherals',
      connectedPeripherals,
    );

    for (var i = 0; i < connectedPeripherals.length; i++) {
      var peripheral = connectedPeripherals[i];
      addOrUpdatePeripheral(
        peripheral.id,
        {
          ...peripheral,
          connected: true,
        },
        setPeripherals,
      );
    }
  } catch (error) {
    console.error(
      '[retrieveConnected] unable to retrieve connected peripherals.',
      error,
    );
  }
};

export const connectPeripheral = async (
  peripheral: Peripheral,
  peripherals: Map<string, Peripheral>,
  setPeripherals: React.Dispatch<React.SetStateAction<Map<string, Peripheral>>>,
) => {
  try {
    if (peripheral) {
      addOrUpdatePeripheral(
        peripheral.id,
        {
          ...peripheral,
          connecting: true,
        },
        setPeripherals,
      );

      await BleManager.connect(peripheral.id);
      console.debug(`[connectPeripheral][${peripheral.id}] connected.`);

      addOrUpdatePeripheral(
        peripheral.id,
        {
          ...peripheral,
          connecting: false,
          connected: true,
        },
        setPeripherals,
      );

      // before retrieving services, it is often a good idea to let bonding & connection finish properly
      await sleep(900);

      /* Test read current RSSI value, retrieve services first */
      const peripheralData = await BleManager.retrieveServices(peripheral.id);
      console.debug(
        `[connectPeripheral][${peripheral.id}] retrieved peripheral services`,
        peripheralData,
      );

      const rssi = await BleManager.readRSSI(peripheral.id);
      console.debug(
        `[connectPeripheral][${peripheral.id}] retrieved current RSSI value: ${rssi}.`,
      );

      if (peripheralData.characteristics) {
        for (let characteristic of peripheralData.characteristics) {
          if (characteristic.descriptors) {
            for (let descriptor of characteristic.descriptors) {
              try {
                let data = await BleManager.readDescriptor(
                  peripheral.id,
                  characteristic.service,
                  characteristic.characteristic,
                  descriptor.uuid,
                );
                console.debug(
                  `[connectPeripheral][${peripheral.id}] descriptor read as:`,
                  data,
                );
              } catch (error) {
                console.error(
                  `[connectPeripheral][${peripheral.id}] failed to retrieve descriptor ${descriptor} for characteristic ${characteristic}:`,
                  error,
                );
              }
            }
          }
        }
      }

      let p = peripherals.get(peripheral.id);
      if (p) {
        addOrUpdatePeripheral(
          peripheral.id,
          { ...peripheral, rssi },
          setPeripherals,
        );
      }
    }
  } catch (error) {
    console.error(
      `[connectPeripheral][${peripheral.id}] connectPeripheral error`,
      error,
    );
  }
};

export const handleAndroidPermissions = () => {
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]).then(result => {
      if (result) {
        console.debug(
          '[handleAndroidPermissions] User accepts runtime permissions android 12+',
        );
      } else {
        console.error(
          '[handleAndroidPermissions] User refuses runtime permissions android 12+',
        );
      }
    });
  } else if (Platform.OS === 'android' && Platform.Version >= 23) {
    PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ).then(checkResult => {
      if (checkResult) {
        console.debug(
          '[handleAndroidPermissions] runtime permission Android <12 already OK',
        );
      } else {
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ).then(requestResult => {
          if (requestResult) {
            console.debug(
              '[handleAndroidPermissions] User accepts runtime permission android <12',
            );
          } else {
            console.error(
              '[handleAndroidPermissions] User refuses runtime permission android <12',
            );
          }
        });
      }
    });
  }
};

export function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
