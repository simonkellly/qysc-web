import { QYSC_CHARACTERISTIC, QYSC_MAC_PREFIX, QYSC_NAME_PREFIX, QYSC_SERVICE } from "./constants";
import { solvedState } from "./stateUtils";
import { ackPacket, decodePacket, helloPacket, syncPacket, freshStatePacket } from "./protocol";
import createCubeState from "./cubeState";

class GattOperationQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        await operation();
      }
    }
    this.processing = false;
  }
}

export type QYSC = Awaited<ReturnType<typeof connectQYSC>>;

export async function connectQYSC() {
  const btCube = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: QYSC_NAME_PREFIX }],
    optionalServices: [QYSC_SERVICE],
  });

  if (!btCube || !btCube.gatt) throw new Error("No device found");

  const server = await btCube.gatt.connect();
  const operationQueue = new GattOperationQueue();

  const service = await server.getPrimaryService(QYSC_SERVICE);
  const characteristic = await service.getCharacteristic(QYSC_CHARACTERISTIC);

  const cubeState = await createCubeState();

  characteristic.addEventListener(
    "characteristicvaluechanged",
    async function (this: BluetoothRemoteGATTCharacteristic) {
      if (!this.value?.buffer) return;
      const packet = new Uint8Array(this.value.buffer);
      const data = decodePacket(packet);

      if (data.needsAck) {
        await operationQueue.enqueue(() => characteristic.writeValue(ackPacket(data.raw)));
      }

      cubeState.handler[data.opcode](data as any);
    }
  );

  await operationQueue.enqueue(() => characteristic.startNotifications());

  // name like QY-QYSC-S-01C4 -> 0x01, 0xC4
  const trimmedName = btCube.name!.trim();
  const macName = trimmedName.substring(trimmedName.length - 4);
  const mac = new Uint8Array([
    ...QYSC_MAC_PREFIX,
    parseInt(macName.slice(0, 2), 16),
    parseInt(macName.slice(2, 4), 16),
  ]);

  const hello = helloPacket(mac);
  await operationQueue.enqueue(() => characteristic.writeValue(hello));

  let freshStateTimeout: Timer | undefined = undefined;
  cubeState.cubeStateEvents.subscribe(ev => {
    if (ev.type !== 'state') return;
    if (freshStateTimeout) clearTimeout(freshStateTimeout);
    freshStateTimeout = setTimeout(async () => {
      await operationQueue.enqueue(() => characteristic.writeValue(freshStatePacket()));
    }, 100);
  });

  return {
    name: btCube.name,
    sync: async () => {
      const state = solvedState();
      const packet = syncPacket(state);
      await operationQueue.enqueue(() => characteristic.writeValue(packet));
    },
    freshState: async () => {
      await operationQueue.enqueue(() => characteristic.writeValue(freshStatePacket()));
    },
    disconnect: async () => {
      btCube.gatt?.disconnect();
    },
    events: {
      state: cubeState.cubeStateEvents,
      moves: cubeState.cubeMoveEvents,
    }
  };
}