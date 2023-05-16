/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */
/**
 * Fingerprint Locations
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
  FlatList,
  SafeAreaView,
} from 'react-native';

import ScreenWrapper from './components/common/ScreenWrapper';
import { mapRssiToProgress } from './utils/helpers';
import {
  startScan,
  handleStopScan,
  retrieveConnected,
  handleDiscoverPeripheral,
  handleDisconnectedPeripheral,
  handleUpdateValueForCharacteristic,
  handleAndroidPermissions,
} from './utils/bluetooth';

const theme = {
  ...LightTheme,
  roundness: 3,
};

import BleManager, { Peripheral } from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

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

  useEffect(() => {
    BleManager.enableBluetooth()
      .then(() => {
        console.log('Bluetooth is turned on!');
      })
      .catch((error: Error) => {
        console.log('Error enabling bluetooth: ', error);
      });
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
        peripheral => handleDiscoverPeripheral(peripheral, setPeripherals),
      ),
      bleManagerEmitter.addListener('BleManagerStopScan', () =>
        handleStopScan(setIsScanning),
      ),
      bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', event =>
        handleDisconnectedPeripheral(event, peripherals, setPeripherals),
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
  }, []);

  const renderItem = ({ item }: { item: Peripheral }) => {
    const progress = mapRssiToProgress(item.rssi);
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
          <Button
            style={style.button}
            mode="outlined"
            onPress={() =>
              startScan(isScanning, setIsScanning, setPeripherals)
            }>
            {isScanning ? 'Scanning...' : 'Scan Bluetooth'}
          </Button>

          <Button
            style={style.button}
            mode="outlined"
            onPress={() => retrieveConnected(setPeripherals)}>
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
