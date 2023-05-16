/* eslint-disable react-native/no-inline-styles */
/**
 * Fingerprint Locations
 *
 */

import React, { useState, useEffect } from 'react';
import {
  Provider as PaperProvider,
  MD3LightTheme as LightTheme,
  Button,
  Text,
  Surface,
  ProgressBar,
} from 'react-native-paper';
import {
  StyleSheet,
  View,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

const SECONDS_TO_SCAN_FOR = 7;
const SERVICE_UUIDS: string[] = [];
const ALLOW_DUPLICATES = true;

const theme = {
  ...LightTheme,
  roundness: 3,
};

import BleManager, {
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
  BleScanCallbackType,
  BleScanMatchMode,
  BleScanMode,
  Peripheral,
} from 'react-native-ble-manager';
import ScreenWrapper from './components/common/ScreenWrapper';
import { mapRssiToProgress } from './components/utils/helpers';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

declare module 'react-native-ble-manager' {
  // enrich local contract with custom state properties needed by App.tsx
  interface Peripheral {
    connected?: boolean;
    connecting?: boolean;
  }
}

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(
    new Map<Peripheral['id'], Peripheral>(),
  );
  const [mockPeri, setMockPeri] = useState(
    new Map<Peripheral['id'], Peripheral>([
      [
        'DC:0D:30:14:51:1D',
        {
          id: 'DC:0D:30:14:51:1D',
          name: 'FSC-BP109T',
          rssi: -55,
          advertising: {
            localName: 'FSC-BP109T',
            serviceUUIDs: ['fef6'],
            isConnectable: true,
          },
          connected: false,
        },
      ],
      [
        'DC:0D:30:14:51:1C',
        {
          id: 'DC:0D:30:14:51:1C',
          name: 'FSC-BP110T',
          rssi: -79,
          advertising: {
            localName: 'FSC-BP110T',
            serviceUUIDs: ['fef7'],
            isConnectable: true,
          },
          connected: true,
        },
      ],
      [
        'DC:0D:30:14:51:1B',
        {
          id: 'DC:0D:30:14:51:1B',
          name: 'FSC-BP111T',
          rssi: -45,
          advertising: {
            localName: 'FSC-BP111T',
            serviceUUIDs: ['fef8'],
            isConnectable: true,
          },
          connected: false,
        },
      ],
      [
        'DC:0D:30:14:51:1A',
        {
          id: 'DC:0D:30:14:51:1A',
          name: 'FSC-BP112T',
          rssi: -33,
          advertising: {
            localName: 'FSC-BP112T',
            serviceUUIDs: ['fef9'],
            isConnectable: false,
          },
          connected: true,
        },
      ],
    ]),
  );

  console.debug('peripherals map updated', [...peripherals.entries()]);

  const addOrUpdatePeripheral = (id: string, updatedPeripheral: Peripheral) => {
    // new Map() enables changing the reference & refreshing UI.
    // TOFIX not efficient.
    setPeripherals(map => new Map(map.set(id, updatedPeripheral)));
  };

  const startScan = () => {
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

  const handleStopScan = () => {
    setIsScanning(false);
    console.debug('[handleStopScan] scan is stopped.');
  };

  const handleDisconnectedPeripheral = (
    event: BleDisconnectPeripheralEvent,
  ) => {
    let peripheral = peripherals.get(event.peripheral);
    if (peripheral) {
      console.debug(
        `[handleDisconnectedPeripheral][${peripheral.id}] previously connected peripheral is disconnected.`,
        event.peripheral,
      );
      addOrUpdatePeripheral(peripheral.id, { ...peripheral, connected: false });
    }
    console.debug(
      `[handleDisconnectedPeripheral][${event.peripheral}] disconnected.`,
    );
  };

  const handleUpdateValueForCharacteristic = (
    data: BleManagerDidUpdateValueForCharacteristicEvent,
  ) => {
    console.debug(
      `[handleUpdateValueForCharacteristic] received data from '${data.peripheral}' with characteristic='${data.characteristic}' and value='${data.value}'`,
    );
  };

  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    console.debug('[handleDiscoverPeripheral] new BLE peripheral=', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    addOrUpdatePeripheral(peripheral.id, peripheral);
  };

  const togglePeripheralConnection = async (peripheral: Peripheral) => {
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
      await connectPeripheral(peripheral);
    }
  };

  const retrieveConnected = async () => {
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
        addOrUpdatePeripheral(peripheral.id, {
          ...peripheral,
          connected: true,
        });
      }
    } catch (error) {
      console.error(
        '[retrieveConnected] unable to retrieve connected peripherals.',
        error,
      );
    }
  };

  const connectPeripheral = async (peripheral: Peripheral) => {
    try {
      if (peripheral) {
        addOrUpdatePeripheral(peripheral.id, {
          ...peripheral,
          connecting: true,
        });

        await BleManager.connect(peripheral.id);
        console.debug(`[connectPeripheral][${peripheral.id}] connected.`);

        addOrUpdatePeripheral(peripheral.id, {
          ...peripheral,
          connecting: false,
          connected: true,
        });

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
          addOrUpdatePeripheral(peripheral.id, { ...peripheral, rssi });
        }
      }
    } catch (error) {
      console.error(
        `[connectPeripheral][${peripheral.id}] connectPeripheral error`,
        error,
      );
    }
  };

  function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  useEffect(() => {
    try {
      BleManager.start({ showAlert: false })
        .then(() => console.debug('BleManager started.'))
        .catch(error =>
          console.error('BeManager could not be started.', error),
        );
    } catch (error) {
      console.error('unexpected error starting BleManager.', error);
      return;
    }

    const listeners = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      ),
    ];

    handleAndroidPermissions();

    return () => {
      console.debug('[app] main component unmounting. Removing listeners...');
      for (const listener of listeners) {
        listener.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAndroidPermissions = () => {
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

  const renderItem = ({ item }: { item: Peripheral }) => {
    const progress = mapRssiToProgress(item.rssi)
    return (
      <>
        <Surface style={style.surface} elevation={2}>
          <View style={style.viewInsideSurface}>
            <Text>{item.name}</Text>
            <Text>{item.id}</Text>
            <Text>{item.advertising.serviceUUIDs}</Text>
            <Text>{item.rssi}</Text>
          </View>

          <View>
            <ProgressBar progress={progress} color={LightTheme.colors.error} />
          </View>
        </Surface>
      </>
    );
  };

  return (
    <>
      <PaperProvider theme={theme}>
        <ScreenWrapper withScrollView={false} style={{ padding: 4 }}>
          <Button style={style.button} mode="outlined" onPress={startScan}>
            {isScanning ? 'Scanning...' : 'Scan Bluetooth'}
          </Button>

          <Button
            style={style.button}
            mode="outlined"
            onPress={retrieveConnected}>
            {'Retrieve connected peripherals'}
          </Button>

          {Array.from(peripherals.values()).length === 0 && (
            <View>
              <Text>No Peripherals, press "Scan Bluetooth" above.</Text>
              <SafeAreaView style={style.center}>
                <FlatList
                  data={Array.from(mockPeri.values())}
                  contentContainerStyle={{ rowGap: 12 }}
                  renderItem={renderItem}
                  keyExtractor={item => item.id}
                />
              </SafeAreaView>
              <Text variant="titleMedium">TEXT</Text>
              <ProgressBar progress={0.5} />
            </View>
          )}
          <FlatList
            data={Array.from(peripherals.values())}
            contentContainerStyle={{ rowGap: 12 }}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
          <StatusBar />
        </ScreenWrapper>
      </PaperProvider>
    </>
  );
};

const style = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: 8,
    padding: 4,
  },
  surface: {
    padding: 4,
    height: 50,
    minWidth: '90%',
  },
  viewInsideSurface: {
    margin: 10,
    minWidth: '80%',
    backgroundColor: 'lightblue',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
});

export default App;
