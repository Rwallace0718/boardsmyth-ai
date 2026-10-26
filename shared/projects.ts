// Starter projects. Each one is a request that fills the prompt box; the AI then writes the code
// for whichever board is selected, so pins and libraries always match the board.
export interface StarterProject {
  id: string;
  title: string;
  category: string;
  level: 'Beginner' | 'Easy' | 'Intermediate';
  /** Parts the user needs, besides the board and a USB cable. */
  parts: string;
  summary: string;
  prompt: string;
}

export const PROJECT_CATEGORIES = ['Lights', 'Buttons & input', 'Sensors', 'Motion', 'Sound', 'Displays', 'Wireless'] as const;

export const STARTER_PROJECTS: StarterProject[] = [
  {
    id: 'blink', title: 'Blink the built-in LED', category: 'Lights', level: 'Beginner', parts: 'Nothing extra',
    summary: 'The "hello world" of boards. Proves your board, cable and upload all work.',
    prompt: 'Blink the board\'s built-in LED once per second, and print "ON" and "OFF" to the serial monitor each time it changes.',
  },
  {
    id: 'led-external', title: 'Blink an external LED', category: 'Lights', level: 'Beginner', parts: '1 LED, 1 resistor (220 ohm), 2 jumper wires',
    summary: 'Wire your own LED safely with a resistor.',
    prompt: 'Blink an external LED on a free digital pin, twice per second. Show the wiring including the resistor.',
  },
  {
    id: 'traffic-light', title: 'Traffic light', category: 'Lights', level: 'Easy', parts: '3 LEDs (red, yellow, green), 3 resistors',
    summary: 'Red, green and yellow in the right order with proper timing.',
    prompt: 'Make a traffic light with a red, yellow and green LED. Cycle green 5 seconds, yellow 2 seconds, red 5 seconds. Use millis() timing, not delay().',
  },
  {
    id: 'fade', title: 'Breathing LED', category: 'Lights', level: 'Easy', parts: '1 LED, 1 resistor',
    summary: 'Smoothly fade an LED up and down using PWM.',
    prompt: 'Make an LED smoothly fade in and out like it is breathing, using a PWM-capable pin. Use millis() timing so the loop stays responsive.',
  },
  {
    id: 'knight-rider', title: 'Knight Rider scanner', category: 'Lights', level: 'Easy', parts: '5-8 LEDs, matching resistors',
    summary: 'A light that sweeps back and forth across a row of LEDs.',
    prompt: 'Make a row of 6 LEDs sweep back and forth like the Knight Rider scanner. Use millis() timing and an array of pins.',
  },
  {
    id: 'rgb', title: 'RGB color cycle', category: 'Lights', level: 'Easy', parts: '1 RGB LED, 3 resistors',
    summary: 'Slowly cycle one LED through every color.',
    prompt: 'Cycle an RGB LED smoothly through the whole rainbow using PWM on three pins. Say whether the LED is common cathode or common anode in the notes and write the code for common cathode.',
  },
  {
    id: 'neopixel', title: 'NeoPixel rainbow strip', category: 'Lights', level: 'Intermediate', parts: 'WS2812B / NeoPixel strip, 330 ohm resistor, external 5V supply for long strips',
    summary: 'A moving rainbow on an addressable LED strip.',
    prompt: 'Run a moving rainbow animation on a strip of 30 WS2812B (NeoPixel) LEDs on one data pin. Use the Adafruit NeoPixel library and include power advice in the safety notes.',
  },
  {
    id: 'button-led', title: 'Button turns on an LED', category: 'Buttons & input', level: 'Beginner', parts: '1 push button, 1 LED, 1 resistor',
    summary: 'Hold the button, the light comes on.',
    prompt: 'Turn an LED on while a push button is held down. Use the internal pull-up resistor so the button needs only two wires.',
  },
  {
    id: 'button-toggle', title: 'Press to toggle', category: 'Buttons & input', level: 'Easy', parts: '1 push button, 1 LED, 1 resistor',
    summary: 'One press turns the light on, the next turns it off, with proper debouncing.',
    prompt: 'Toggle an LED on and off each time a push button is pressed. Debounce the button properly with millis(), and print the state to the serial monitor.',
  },
  {
    id: 'pot-brightness', title: 'Dimmer knob', category: 'Buttons & input', level: 'Easy', parts: '1 potentiometer (10k), 1 LED, 1 resistor',
    summary: 'Turn a knob to dim an LED.',
    prompt: 'Read a potentiometer on an analog pin and use it to set the brightness of an LED with PWM. Print the reading to the serial monitor.',
  },
  {
    id: 'temp', title: 'Temperature readout', category: 'Sensors', level: 'Easy', parts: 'DHT11 or DHT22 sensor, 10k resistor if the sensor is bare',
    summary: 'Read temperature and humidity and print it every 2 seconds.',
    prompt: 'Read temperature (in both Celsius and Fahrenheit) and humidity from a DHT22 sensor every 2 seconds and print them to the serial monitor. Use the DHT sensor library.',
  },
  {
    id: 'light-sensor', title: 'Night light', category: 'Sensors', level: 'Easy', parts: '1 photoresistor, 1 10k resistor, 1 LED, 1 resistor',
    summary: 'The LED turns on by itself when the room gets dark.',
    prompt: 'Make a night light: read a photoresistor (light sensor) on an analog pin and turn an LED on when it gets dark. Add a small buffer zone so it does not flicker at the threshold, and print the reading.',
  },
  {
    id: 'distance', title: 'Distance meter', category: 'Sensors', level: 'Easy', parts: 'HC-SR04 ultrasonic sensor',
    summary: 'Measure how far away something is.',
    prompt: 'Measure distance with an HC-SR04 ultrasonic sensor and print it in centimeters and inches twice per second. Warn me in the safety notes if the sensor needs 5V on a 3.3V board.',
  },
  {
    id: 'motion', title: 'Motion alarm', category: 'Sensors', level: 'Easy', parts: 'PIR motion sensor, 1 LED, 1 buzzer (optional)',
    summary: 'Lights up (and beeps) when someone walks by.',
    prompt: 'Use a PIR motion sensor to trigger an alarm: turn on an LED and a buzzer for 3 seconds whenever motion is detected, with a 10 second warm-up at start. Print events to the serial monitor.',
  },
  {
    id: 'soil', title: 'Plant moisture monitor', category: 'Sensors', level: 'Easy', parts: 'Capacitive soil moisture sensor, 1 LED',
    summary: 'Know when your plant needs water.',
    prompt: 'Read a capacitive soil moisture sensor on an analog pin and print a percentage. Turn an LED on when the soil is too dry. Explain how to calibrate the dry and wet values.',
  },
  {
    id: 'servo-sweep', title: 'Servo sweep', category: 'Motion', level: 'Easy', parts: '1 hobby servo (SG90), external 5V supply recommended',
    summary: 'Sweep a servo arm back and forth.',
    prompt: 'Sweep a hobby servo from 0 to 180 degrees and back, smoothly, using the Servo library. Give power advice in the safety notes.',
  },
  {
    id: 'servo-knob', title: 'Servo controlled by a knob', category: 'Motion', level: 'Easy', parts: '1 servo, 1 potentiometer',
    summary: 'Turn the knob, the servo follows.',
    prompt: 'Move a hobby servo to match a potentiometer position. Smooth the readings so the servo does not jitter.',
  },
  {
    id: 'stepper', title: 'Stepper motor spin', category: 'Motion', level: 'Intermediate', parts: '28BYJ-48 stepper with ULN2003 driver',
    summary: 'Rotate a stepper one revolution each way.',
    prompt: 'Turn a 28BYJ-48 stepper motor with a ULN2003 driver one full revolution clockwise, pause, then one revolution counter-clockwise, repeating. Use the Stepper library or AccelStepper.',
  },
  {
    id: 'dc-motor', title: 'DC motor speed control', category: 'Motion', level: 'Intermediate', parts: 'DC motor, motor driver (L298N or transistor + diode), external power',
    summary: 'Drive a small motor safely, with speed set by a knob.',
    prompt: 'Control the speed of a small DC motor through a motor driver (L298N) using PWM, with speed set by a potentiometer. Never drive the motor directly from a pin; give full wiring and power advice.',
  },
  {
    id: 'buzzer-melody', title: 'Play a melody', category: 'Sound', level: 'Easy', parts: '1 passive buzzer',
    summary: 'Play a short tune on a buzzer.',
    prompt: 'Play a short recognizable melody on a passive buzzer using tone(), with note names and durations in arrays. Pressing nothing needed; repeat every 5 seconds.',
  },
  {
    id: 'doorbell', title: 'Doorbell button', category: 'Sound', level: 'Easy', parts: '1 push button, 1 buzzer',
    summary: 'Press the button, hear a two-tone chime.',
    prompt: 'Play a two-tone doorbell chime on a buzzer when a button is pressed. Debounce the button and do not retrigger while the chime plays.',
  },
  {
    id: 'lcd', title: 'LCD message and counter', category: 'Displays', level: 'Easy', parts: '16x2 I2C LCD',
    summary: 'Show text and a running counter on an LCD.',
    prompt: 'Show "Hello, BoardSmyth!" on the first line of a 16x2 I2C LCD and a seconds counter on the second line. Use the LiquidCrystal I2C library and tell me how to find the I2C address.',
  },
  {
    id: 'oled', title: 'OLED sensor display', category: 'Displays', level: 'Intermediate', parts: '128x64 I2C OLED (SSD1306), DHT22 sensor',
    summary: 'A tiny dashboard showing temperature and humidity.',
    prompt: 'Show temperature and humidity from a DHT22 on a 128x64 I2C SSD1306 OLED display, updating every 2 seconds. Use Adafruit SSD1306 and GFX libraries.',
  },
  {
    id: 'wifi-scan', title: 'WiFi network scanner', category: 'Wireless', level: 'Easy', parts: 'WiFi-capable board (ESP32, ESP8266, Pico W, Uno R4 WiFi)',
    summary: 'List the WiFi networks around you with signal strength.',
    prompt: 'Scan for nearby WiFi networks every 10 seconds and print the name, signal strength and encryption type to the serial monitor. Use only what this board supports and tell me in the notes if this board has no WiFi.',
  },
  {
    id: 'wifi-led', title: 'WiFi web switch', category: 'Wireless', level: 'Intermediate', parts: 'WiFi-capable board, 1 LED',
    summary: 'Turn an LED on and off from a web page on your phone.',
    prompt: 'Run a small web server on this board so I can turn an LED on and off from a web page on my phone. Put WIFI_SSID and WIFI_PASSWORD constants at the top for me to fill in, and print the board\'s IP address to the serial monitor. Tell me in the notes if this board has no WiFi.',
  },
  {
    id: 'ble', title: 'Bluetooth LED control', category: 'Wireless', level: 'Intermediate', parts: 'Bluetooth-capable board (ESP32, Nano 33 BLE, Uno R4 WiFi), 1 LED',
    summary: 'Switch an LED from a Bluetooth app on your phone.',
    prompt: 'Make the board a Bluetooth Low Energy device with one writable characteristic that turns an LED on and off, so I can control it from a BLE app like nRF Connect. Tell me in the notes if this board has no Bluetooth.',
  },
];
