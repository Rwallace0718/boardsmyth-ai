import type { BoardOption } from '../shared/types';

/**
 * Extra board package indexes, so the catalog covers more than the official
 * Arduino boards. All of these are the maintainers' own public index files.
 */
export const ADDITIONAL_BOARD_URLS: string[] = [
  // ESP32 family (Espressif)
  'https://espressif.github.io/arduino-esp32/package_esp32_index.json',
  // ESP8266
  'https://arduino.esp8266.com/stable/package_esp8266com_index.json',
  // Raspberry Pi Pico / RP2040 / RP2350 (arduino-pico)
  'https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json',
  // STM32 (STMicroelectronics)
  'https://github.com/stm32duino/BoardManagerFiles/raw/main/package_stmicroelectronics_index.json',
  // Teensy
  'https://www.pjrc.com/teensy/package_teensy_index.json',
  // Bare ATmega / ATtiny chips (MCUdude)
  'https://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json',
  'https://mcudude.github.io/MegaCore/package_MCUdude_MegaCore_index.json',
  'https://mcudude.github.io/MightyCore/package_MCUdude_MightyCore_index.json',
  'https://mcudude.github.io/MicroCore/package_MCUdude_MicroCore_index.json',
  // Adafruit and SparkFun boards
  'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json',
  'https://raw.githubusercontent.com/sparkfun/Arduino_Boards/main/IDE_Board_Manager/package_sparkfun_index.json',
];

/** Shown first in the picker. Anything not in the downloaded catalog is hidden. */
export const POPULAR_BOARDS: BoardOption[] = [
  { name: 'Arduino Uno', fqbn: 'arduino:avr:uno', core: 'arduino:avr' },
  { name: 'Arduino Nano', fqbn: 'arduino:avr:nano', core: 'arduino:avr' },
  { name: 'Arduino Mega or Mega 2560', fqbn: 'arduino:avr:mega', core: 'arduino:avr' },
  { name: 'Arduino Leonardo', fqbn: 'arduino:avr:leonardo', core: 'arduino:avr' },
  { name: 'Arduino Micro', fqbn: 'arduino:avr:micro', core: 'arduino:avr' },
  { name: 'Arduino Nano Every', fqbn: 'arduino:megaavr:nona4809', core: 'arduino:megaavr' },
  { name: 'Arduino Uno R4 WiFi', fqbn: 'arduino:renesas_uno:unor4wifi', core: 'arduino:renesas_uno' },
  { name: 'Arduino Uno R4 Minima', fqbn: 'arduino:renesas_uno:minima', core: 'arduino:renesas_uno' },
  { name: 'Arduino Nano 33 IoT', fqbn: 'arduino:samd:nano_33_iot', core: 'arduino:samd' },
  { name: 'Arduino MKR WiFi 1010', fqbn: 'arduino:samd:mkrwifi1010', core: 'arduino:samd' },
  { name: 'Arduino Nano 33 BLE', fqbn: 'arduino:mbed_nano:nano33ble', core: 'arduino:mbed_nano' },
  { name: 'Arduino Nano RP2040 Connect', fqbn: 'arduino:mbed_nano:nanorp2040connect', core: 'arduino:mbed_nano' },
  { name: 'Arduino Nano ESP32', fqbn: 'arduino:esp32:nano_nora', core: 'arduino:esp32' },
  { name: 'Arduino Due (Programming Port)', fqbn: 'arduino:sam:arduino_due_x_dbg', core: 'arduino:sam' },
  { name: 'Arduino Portenta H7', fqbn: 'arduino:mbed_portenta:envie_m7', core: 'arduino:mbed_portenta' },
  { name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32', core: 'esp32:esp32' },
  { name: 'ESP32-S3 Dev Module', fqbn: 'esp32:esp32:esp32s3', core: 'esp32:esp32' },
  { name: 'ESP32-C3 Dev Module', fqbn: 'esp32:esp32:esp32c3', core: 'esp32:esp32' },
  { name: 'ESP8266 NodeMCU 1.0', fqbn: 'esp8266:esp8266:nodemcuv2', core: 'esp8266:esp8266' },
  { name: 'Raspberry Pi Pico', fqbn: 'rp2040:rp2040:rpipico', core: 'rp2040:rp2040' },
  { name: 'Raspberry Pi Pico W', fqbn: 'rp2040:rp2040:rpipicow', core: 'rp2040:rp2040' },
  { name: 'Teensy 4.1', fqbn: 'teensy:avr:teensy41', core: 'teensy:avr' },
];

export function coreForFqbn(fqbn: string): string {
  const parts = fqbn.split(':');
  return `${parts[0]}:${parts[1]}`;
}

/** Known upload gotchas by board family, shown in the UI and appended to upload errors. */
export function uploadHint(core: string, fqbn = ''): string | undefined {
  switch (core) {
    case 'rp2040:rp2040':
    case 'arduino:mbed_rp2040':
      return 'If upload fails, unplug the board, hold the BOOTSEL button while plugging it back in, then press Upload.';
    case 'esp32:esp32':
    case 'arduino:esp32':
      return 'If upload hangs at "Connecting…", hold the BOOT button on the board while pressing Upload.';
    case 'esp8266:esp8266':
      return 'If upload fails, hold the FLASH button while pressing Upload, and try a slower Upload Speed in Board options.';
    case 'teensy:avr':
      return 'Press the button on the Teensy when the uploader asks, if it does not start by itself.';
    case 'arduino:avr':
      if (!fqbn.includes(':nano')) return undefined;
      return 'Older Nano clones need Processor set to "ATmega328P (Old Bootloader)" in Board options.';
    case 'arduino:mbed_nano':
    case 'arduino:mbed_portenta':
    case 'arduino:mbed_giga':
    case 'arduino:mbed_nicla':
      return 'If the port disappears, double-tap the reset button to enter the bootloader, then Upload again.';
    case 'arduino:samd':
    case 'arduino:sam':
      return 'If the board is not found, double-tap reset to enter the bootloader and pick the new port.';
    case 'STMicroelectronics:stm32':
      return 'Set the Upload method in Board options to match your programmer (ST-LINK, DFU or serial).';
    default:
      return undefined;
  }
}
