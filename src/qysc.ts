import { QYSC_CHARACTERISTIC, QYSC_MAC_PREFIX, QYSC_NAME_PREFIX, QYSC_SERVICE } from "./constants";
import { solvedState } from "./stateUtils";
import { ackPacket, decodePacket, helloPacket, syncPacket, freshStatePacket } from "./protocol";
import createCubeState from "./cubeState";

export type QYSC = Awaited<ReturnType<typeof connectQYSC>>;

export async function connectQYSC() {
  const btCube = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: QYSC_NAME_PREFIX }],
    optionalServices: [QYSC_SERVICE],
  });

  if (!btCube || !btCube.gatt) throw new Error("No device found");

  const server = await btCube.gatt.connect();

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
        await characteristic.writeValue(ackPacket(data.raw));
      }

      cubeState.handler[data.opcode](data as any);
    }
  );

  await characteristic.startNotifications();

  // name like QY-QYSC-S-01C4 -> 0x01, 0xC4
  const trimmedName = btCube.name!.trim();
  const macName = trimmedName.substring(trimmedName.length - 4);
  const mac = new Uint8Array([
    ...QYSC_MAC_PREFIX,
    parseInt(macName.slice(0, 2), 16),
    parseInt(macName.slice(2, 4), 16),
  ]);

  const hello = helloPacket(mac);
  await characteristic.writeValue(hello);

  let freshStateTimeout: Timer | undefined = undefined;
  cubeState.cubeStateEvents.subscribe(ev => {
    if (ev.type !== 'state') return;
    if (freshStateTimeout) clearTimeout(freshStateTimeout);
    freshStateTimeout = setTimeout(async () => {
      await characteristic.writeValue(freshStatePacket());
    }, 200);
  });

  return {
    name: btCube.name,
    sync: async () => {
      const state = solvedState();
      const packet = syncPacket(state);
      await characteristic.writeValue(packet);
    },
    freshState: async () => {
      await characteristic.writeValue(freshStatePacket());
    },
    disconnect: async () => {
      btCube.gatt?.disconnect();
    },
    events: {
      state: cubeState.cubeStateEvents,
      moves: cubeState.cubeMoveEvents,
    }
  }
}