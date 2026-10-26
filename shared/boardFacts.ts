// Built-in pin facts for popular boards. They are given to the AI so it uses each board's real pins and limits,
// and shown to the user on the Pins tab. Only facts that are the same on every unit of the board are listed.
// Always point users to the official page for anything safety-critical.
export interface BoardFacts {
  name: string;
  /** Short summary used as the first line. */
  summary: string;
  rows: { label: string; value: string }[];
  docs?: string;
}

const AVR_UNO_LIKE: BoardFacts['rows'] = [
  { label: 'Logic level', value: '5 V (pins are NOT tolerant of more than 5 V)' },
  { label: 'Digital pins', value: 'D0 to D13, plus A0 to A5 usable as D14 to D19' },
  { label: 'PWM pins', value: 'D3, D5, D6, D9, D10, D11' },
  { label: 'Analog inputs', value: 'A0 to A5 (10-bit, 0 to 1023)' },
  { label: 'I2C', value: 'SDA = A4, SCL = A5' },
  { label: 'SPI', value: 'SS = D10, MOSI = D11, MISO = D12, SCK = D13' },
  { label: 'Interrupt pins', value: 'D2, D3' },
  { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
  { label: 'Avoid', value: 'D0 and D1 (USB serial, used when uploading and for Serial output)' },
  { label: 'Current limits', value: '20 mA recommended per pin (40 mA absolute max), about 200 mA total' },
];

const FACTS: Record<string, BoardFacts> = {
  'arduino:avr:uno': {
    name: 'Arduino Uno (R3)',
    summary: '5 V ATmega328P, 32 KB flash, 2 KB RAM.',
    rows: AVR_UNO_LIKE,
    docs: 'https://docs.arduino.cc/hardware/uno-rev3/',
  },
  'arduino:avr:nano': {
    name: 'Arduino Nano',
    summary: '5 V ATmega328P, 32 KB flash, 2 KB RAM. Same pins as the Uno, plus two analog-only inputs.',
    rows: [...AVR_UNO_LIKE, { label: 'Extra analog inputs', value: 'A6 and A7 (analog input only, cannot be used as digital pins)' }],
    docs: 'https://docs.arduino.cc/hardware/nano/',
  },
  'arduino:avr:mega': {
    name: 'Arduino Mega 2560',
    summary: '5 V ATmega2560, 256 KB flash, 8 KB RAM, many pins and four hardware serial ports.',
    rows: [
      { label: 'Logic level', value: '5 V' },
      { label: 'Digital pins', value: 'D0 to D53' },
      { label: 'PWM pins', value: 'D2 to D13 and D44 to D46' },
      { label: 'Analog inputs', value: 'A0 to A15 (10-bit)' },
      { label: 'I2C', value: 'SDA = D20, SCL = D21' },
      { label: 'SPI', value: 'MISO = D50, MOSI = D51, SCK = D52, SS = D53' },
      { label: 'Interrupt pins', value: 'D2, D3, D18, D19, D20, D21' },
      { label: 'Extra serial ports', value: 'Serial1 = D18 (TX) / D19 (RX), Serial2 = D16 / D17, Serial3 = D14 / D15' },
      { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
      { label: 'Avoid', value: 'D0 and D1 (USB serial)' },
      { label: 'Current limits', value: '20 mA recommended per pin (40 mA absolute max)' },
    ],
    docs: 'https://docs.arduino.cc/hardware/mega-2560/',
  },
  'arduino:avr:leonardo': {
    name: 'Arduino Leonardo',
    summary: '5 V ATmega32U4 with native USB (can act as a keyboard or mouse). Serial is the USB port; Serial1 is on pins 0 and 1.',
    rows: [
      { label: 'Logic level', value: '5 V' },
      { label: 'PWM pins', value: 'D3, D5, D6, D9, D10, D11, D13' },
      { label: 'Analog inputs', value: 'A0 to A5, plus A6 to A11 on D4, D6, D8, D9, D10, D12' },
      { label: 'I2C', value: 'SDA = D2, SCL = D3' },
      { label: 'Interrupt pins', value: 'D0, D1, D2, D3, D7' },
      { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
      { label: 'Note', value: 'Serial waits for the USB connection; use "while (!Serial)" only if you want to wait for the monitor' },
    ],
    docs: 'https://docs.arduino.cc/hardware/leonardo/',
  },
  'arduino:avr:micro': {
    name: 'Arduino Micro',
    summary: '5 V ATmega32U4 with native USB. Same pin behavior as the Leonardo in a smaller board.',
    rows: [
      { label: 'Logic level', value: '5 V' },
      { label: 'PWM pins', value: 'D3, D5, D6, D9, D10, D11, D13' },
      { label: 'I2C', value: 'SDA = D2, SCL = D3' },
      { label: 'Interrupt pins', value: 'D0, D1, D2, D3, D7' },
      { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
    ],
    docs: 'https://docs.arduino.cc/hardware/micro/',
  },
  'arduino:renesas_uno:minima': {
    name: 'Arduino Uno R4 Minima',
    summary: '5 V Renesas RA4M1 (Arm Cortex-M4, 48 MHz), 256 KB flash, 32 KB RAM. Uno-style pin layout.',
    rows: [
      { label: 'Logic level', value: '5 V' },
      { label: 'Digital pins', value: 'D0 to D13, plus A0 to A5' },
      { label: 'PWM pins', value: 'D3, D5, D6, D9, D10, D11' },
      { label: 'Analog inputs', value: 'A0 to A5; analogReadResolution(12) gives 12-bit readings' },
      { label: 'True analog output', value: 'A0 has a 12-bit DAC (analogWriteResolution(12), analogWrite(A0, value))' },
      { label: 'I2C', value: 'SDA = A4, SCL = A5' },
      { label: 'SPI', value: 'SS = D10, MOSI = D11, MISO = D12, SCK = D13' },
      { label: 'Interrupt pins', value: 'D2, D3' },
      { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
      { label: 'Current limits', value: 'Keep each pin to about 8 mA (weaker than the old Uno); use a transistor for anything more' },
    ],
    docs: 'https://docs.arduino.cc/hardware/uno-r4-minima/',
  },
  'arduino:renesas_uno:unor4wifi': {
    name: 'Arduino Uno R4 WiFi',
    summary: '5 V Renesas RA4M1 plus an ESP32-S3 for WiFi and Bluetooth, with a built-in 12x8 LED matrix.',
    rows: [
      { label: 'Logic level', value: '5 V' },
      { label: 'PWM pins', value: 'D3, D5, D6, D9, D10, D11' },
      { label: 'Analog inputs', value: 'A0 to A5 (12-bit with analogReadResolution(12)); A0 also has a 12-bit DAC' },
      { label: 'I2C', value: 'SDA = A4, SCL = A5; a second Qwiic connector uses Wire1' },
      { label: 'Built-in LED', value: 'D13 (LED_BUILTIN)' },
      { label: 'Wireless libraries', value: 'WiFiS3 for WiFi, ArduinoBLE for Bluetooth; LED matrix uses Arduino_LED_Matrix' },
      { label: 'Current limits', value: 'Keep each pin to about 8 mA' },
    ],
    docs: 'https://docs.arduino.cc/hardware/uno-r4-wifi/',
  },
  'esp32:esp32:esp32': {
    name: 'ESP32 Dev Module (classic ESP32)',
    summary: '3.3 V dual-core ESP32 with WiFi and Bluetooth.',
    rows: [
      { label: 'Logic level', value: '3.3 V. Pins are NOT 5 V tolerant: use a level shifter or divider for 5 V signals' },
      { label: 'Input-only pins', value: 'GPIO 34, 35, 36, 39 (no output, no internal pull-ups)' },
      { label: 'Do not use', value: 'GPIO 6 to 11 (connected to the flash chip)' },
      { label: 'Boot-sensitive pins', value: 'GPIO 0, 2, 5, 12, 15 affect startup; avoid pulling them the wrong way at boot' },
      { label: 'Analog inputs', value: 'Use ADC1 pins (GPIO 32 to 39) when WiFi is on; ADC2 pins do not work while WiFi is running' },
      { label: 'DAC pins', value: 'GPIO 25 and 26 (8-bit)' },
      { label: 'I2C default', value: 'SDA = GPIO 21, SCL = GPIO 22' },
      { label: 'SPI default (VSPI)', value: 'MOSI = 23, MISO = 19, SCK = 18, SS = 5' },
      { label: 'Serial', value: 'UART0 on GPIO 1 (TX) and 3 (RX) is the USB serial; avoid them' },
      { label: 'PWM', value: 'Any output pin through ledcAttach / ledcWrite (not analogWrite on older cores)' },
      { label: 'Built-in LED', value: 'Usually GPIO 2, but it varies by board' },
      { label: 'Current limits', value: 'About 20 mA per pin recommended' },
    ],
    docs: 'https://docs.espressif.com/projects/esp-idf/en/latest/esp32/hw-reference/esp32/get-started-devkitc.html',
  },
  'esp8266:esp8266:nodemcuv2': {
    name: 'ESP8266 NodeMCU 1.0',
    summary: '3.3 V ESP8266 with WiFi. Labels on the board (D0 to D8) differ from GPIO numbers.',
    rows: [
      { label: 'Logic level', value: '3.3 V. Pins are NOT 5 V tolerant' },
      { label: 'Pin map', value: 'D0 = GPIO16, D1 = GPIO5, D2 = GPIO4, D3 = GPIO0, D4 = GPIO2, D5 = GPIO14, D6 = GPIO12, D7 = GPIO13, D8 = GPIO15, RX = GPIO3, TX = GPIO1' },
      { label: 'Built-in LED', value: 'D4 (GPIO2, LED_BUILTIN). It is active LOW: LOW turns it on' },
      { label: 'Analog input', value: 'A0 only (one channel, 10-bit). The board scales it to 0 to 3.3 V' },
      { label: 'I2C default', value: 'SDA = D2 (GPIO4), SCL = D1 (GPIO5)' },
      { label: 'SPI', value: 'SCK = D5, MISO = D6, MOSI = D7, CS = D8' },
      { label: 'Boot-sensitive pins', value: 'D3 (GPIO0), D4 (GPIO2), D8 (GPIO15): the wrong level at startup stops it booting' },
      { label: 'Limits', value: 'D0 (GPIO16) has no PWM or interrupts. About 12 mA per pin is safe' },
    ],
    docs: 'https://www.espressif.com/en/products/socs/esp8266',
  },
  'rp2040:rp2040:rpipico': {
    name: 'Raspberry Pi Pico',
    summary: '3.3 V RP2040 (dual Cortex-M0+), 2 MB flash, 264 KB RAM. Pins are named GP0 to GP28.',
    rows: [
      { label: 'Logic level', value: '3.3 V. Pins are NOT 5 V tolerant' },
      { label: 'GPIO pins', value: 'GP0 to GP22, GP26 to GP28' },
      { label: 'Analog inputs', value: 'GP26 (A0), GP27 (A1), GP28 (A2). 12-bit with analogReadResolution(12)' },
      { label: 'PWM', value: 'Every GPIO pin can do PWM (channels in pairs share a frequency)' },
      { label: 'I2C default (Wire)', value: 'SDA = GP4, SCL = GP5' },
      { label: 'SPI default', value: 'RX (MISO) = GP16, CS = GP17, SCK = GP18, TX (MOSI) = GP19' },
      { label: 'Serial1', value: 'TX = GP0, RX = GP1' },
      { label: 'Built-in LED', value: 'GP25 (LED_BUILTIN)' },
      { label: 'Current limits', value: 'Keep each pin under about 12 mA' },
      { label: 'Upload tip', value: 'Hold BOOTSEL while plugging in USB if upload fails' },
    ],
    docs: 'https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf',
  },
  'rp2040:rp2040:rpipicow': {
    name: 'Raspberry Pi Pico W',
    summary: '3.3 V RP2040 with WiFi and Bluetooth. Same pins as the Pico, but the LED is on the WiFi chip.',
    rows: [
      { label: 'Logic level', value: '3.3 V. Pins are NOT 5 V tolerant' },
      { label: 'GPIO pins', value: 'GP0 to GP22, GP26 to GP28' },
      { label: 'Analog inputs', value: 'GP26 (A0), GP27 (A1), GP28 (A2)' },
      { label: 'I2C default (Wire)', value: 'SDA = GP4, SCL = GP5' },
      { label: 'Built-in LED', value: 'Controlled through the WiFi chip: use LED_BUILTIN with the WiFi library included' },
      { label: 'Current limits', value: 'Keep each pin under about 12 mA' },
    ],
    docs: 'https://datasheets.raspberrypi.com/picow/pico-w-datasheet.pdf',
  },
  'teensy:avr:teensy41': {
    name: 'Teensy 4.1',
    summary: '3.3 V NXP i.MX RT1062 at 600 MHz, 8 MB flash, 1 MB RAM. Very fast.',
    rows: [
      { label: 'Logic level', value: '3.3 V. Pins are NOT 5 V tolerant' },
      { label: 'Analog inputs', value: 'A0 to A17 (up to 12-bit with analogReadResolution)' },
      { label: 'I2C', value: 'SDA = pin 18, SCL = pin 19' },
      { label: 'SPI', value: 'MOSI = 11, MISO = 12, SCK = 13' },
      { label: 'Serial', value: 'Serial is USB at full speed; Serial1 is pins 0 (RX) and 1 (TX)' },
      { label: 'Built-in LED', value: 'Pin 13 (LED_BUILTIN)' },
    ],
    docs: 'https://www.pjrc.com/store/teensy41.html',
  },
};

const FAMILY_NOTES: Record<string, string> = {
  'esp32:esp32': 'ESP32 family: 3.3 V logic, not 5 V tolerant. GPIO numbers differ between ESP32, S2, S3 and C3 variants, so check the board\'s pinout before choosing pins. ADC2 pins do not work while WiFi is on.',
  'esp8266:esp8266': 'ESP8266 family: 3.3 V logic, not 5 V tolerant. Board labels (D0 to D8) differ from GPIO numbers.',
  'rp2040:rp2040': 'RP2040 family: 3.3 V logic, not 5 V tolerant. Pins are named GPn.',
  'arduino:mbed_nano': 'Arduino Nano mbed boards: 3.3 V logic, not 5 V tolerant.',
  'arduino:samd': 'Arduino SAMD boards: 3.3 V logic, not 5 V tolerant.',
  'teensy:avr': 'Teensy: 3.3 V logic on Teensy 3.x and 4.x, not 5 V tolerant (except some 3.x pins).',
  'STMicroelectronics:stm32': 'STM32: 3.3 V logic. Pin names look like PA5; many pins are not 5 V tolerant.',
};

export interface ResolvedFacts {
  facts?: BoardFacts;
  /** Family-level note when there is no exact entry. */
  familyNote?: string;
}

export function factsFor(fqbn: string): ResolvedFacts {
  const parts = fqbn.split(':');
  const base = parts.slice(0, 3).join(':');
  if (FACTS[base]) return { facts: FACTS[base] };
  const family = parts.slice(0, 2).join(':');
  return { familyNote: FAMILY_NOTES[family] };
}

/** Plain text handed to the AI along with the request. */
export function factsForPrompt(fqbn: string): string {
  const { facts, familyNote } = factsFor(fqbn);
  if (facts) {
    return `${facts.name}. ${facts.summary}\n` + facts.rows.map((r) => `- ${r.label}: ${r.value}`).join('\n');
  }
  return familyNote ?? '';
}
