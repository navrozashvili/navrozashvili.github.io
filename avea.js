// byte values  |some magic numbers |white 8 | red 3 |green 2| blue 1|
// hex values   | 35  f4  01  0a 00 | ww  8w | rr 3r | gg 2g | bb 1b |

var preset_off = [53, 244, 1, 10, 0, 0, 128, 0, 48, 0, 32, 0, 16];
var preset_white = [53, 244, 1, 10, 0, 255, 143, 0, 48, 0, 32, 0, 16];
var preset_white2 = [53, 244, 1, 10, 0, 255, 143, 255, 63, 255, 47, 255, 31];
var preset_red = [53, 244, 1, 10, 0, 0, 128, 255, 63, 0, 32, 0, 16];
var preset_green = [53, 244, 1, 10, 0, 0, 128, 0, 48, 255, 47, 0, 16];
var preset_blue = [53, 244, 1, 10, 0, 0, 128, 0, 48, 0, 32, 255, 31];
var preset_yellow = [53, 244, 1, 10, 0, 0, 128, 255, 63, 255, 47, 0, 16];
var preset_cyan = [53, 244, 1, 10, 0, 0, 128, 0, 48, 255, 47, 255, 31];
var preset_magenta = [53, 244, 1, 10, 0, 0, 128, 255, 63, 0, 32, 255, 31];
var max_brightness = [87, 255, 15];
var brigtnessCommandPrefix = "57";
var colorCommandPrefix = "3511010000";
var nameCommandPrefix = "58";
var bulbName;
var bulbBrightness;

var isRunning = false;
async function startColorSequence() {
  if (isRunning) {
    isRunning = false;
    document.getElementById("startButton").innerHTML="Start";
  } else {
    var color = new KolorWheel(document.getElementById("colorFrom").value);
    var iterations=document.getElementById("iterations").value;
    var to = color.abs(document.getElementById("colorTo").value, iterations);
    isRunning = true;
    document.getElementById("startButton").innerHTML="Stop";
    var colors = [];
    for(var n = 0; n <iterations;n++)
    {
      colors.push(to.get(n).getRgb());
    }
    colors = colors.concat(colors.slice().reverse());
    iterations *=2;
    while(isRunning)
    {
      for(var i = 0;i<iterations&&isRunning;i++)
      {
        setRGB(colors[i][0],colors[i][1],colors[i][2]);
        //optimal in my enviorment maybe your system will differ
        await sleep(140);
      }
    }
  }

}
function setBrightnessFromSlider() {
  var percentage = document.getElementById("brightnesSlider").value;
  setBrightnessByPercentage(percentage);
}
function setRGB(red, green, blue) {
  setColor(Math.min(red, green, blue), scaleValue(red), scaleValue(green), scaleValue(blue));
}
function setRGBnoW(red, green, blue) {
  setColor(0, scaleValue(red), scaleValue(green), scaleValue(blue));
}
function setARGB(white, red, green, blue) {
  setColor(scaleValue(white), scaleValue(red), scaleValue(green), scaleValue(blue));
}
function scaleValue(value) {
  return ((value + 1) * 16) - 1;
}
function subscribeToBulbNotifications() {
  characteristic.startNotifications().then(_ => {
    console.log("Characteristic notifications starting");
    characteristic.addEventListener('characteristicvaluechanged', handleNotifications)
  });
  setHexValue("0100");
}
async function getName() {
  setHexValue(nameCommandPrefix);
  await sleep(500);
  return bulbName;
}
async function getBrightness() {
  setHexValue(brigtnessCommandPrefix);
  await sleep(500);
  return bulbBrightness;
}
function setName(name) {
  setValue(Int8Array.from([...hexToBytes(nameCommandPrefix), ...stringToUTF8Bytes(name)]));
}
const sleep = (delay) => new Promise(resolve => {
  setTimeout(resolve, delay);
});
function stringToUTF8Bytes(string) {
  return new TextEncoder().encode(string);
}
async function setbrightnessSilderValue() {
  var brightnessPercentage = Math.ceil(((await getBrightness() + 1) / 4096) * 100);
  document.getElementById("brightnesSlider").value = brightnessPercentage;
}
function handleNotifications(event) {
  let value = event.target.value;
  let a = [];
  for (let i = 0; i < value.byteLength; i++) {
    a.push(value.getUint8(i).toString(16).slice(-2));
  }
  var commandString = a.join("");
  if (commandString.length < 3) {
    console.log("skipping handling command " + commandString);
    return;
  }
  var command = commandString.substring(0, 2);
  var rest = commandString.substring(2);
  switch (command) {
    case "57":
      {
        bulbBrightness = parseInt(rest, 16);
        break;
      }
    case "58":
      {
        bulbName = hexToUtf8(rest.slice(0, -1));
        break;
      }
    case "35":
      {
        //we dont need this info
        break;
      }
    default:
      {
        console.log("unknown notification" + commandString);
      }
  }
  console.log('notification> ' + commandString);
}
function hexToUtf8(s) {
  return decodeURIComponent(
    s.replace(/\s+/g, '')
      .replace(/[0-9a-f]{2}/g, '%$&')
  );
}
function setColor(white, red, green, blue) {
  var whiteHex = decimalNumberToLittleEndianHex(checkValueBounds(white) | 0x8000);
  var redHex = decimalNumberToLittleEndianHex(checkValueBounds(red) | 0x3000);
  var greenHex = decimalNumberToLittleEndianHex(checkValueBounds(green) | 0x2000);
  var blueHex = decimalNumberToLittleEndianHex(checkValueBounds(blue) | 0x1000);
  setHexValue(colorCommandPrefix + whiteHex + redHex + greenHex + blueHex);
}
function setBrightnessByPercentage(value) {
  setBrightness(Math.ceil(4095 * (value / 100)));
}
function setBrightness(value) {
  setHexValue(brigtnessCommandPrefix + decimalNumberToLittleEndianHex(checkValueBounds(value)));
}
function checkValueBounds(value) {
  if (value < 0 || value > 4095) {
    throw "value is out of bounds";
  }
  return value;
}
function decimalNumberToLittleEndianHex(number) {
  return changeEndianness(decimalHexTwosComplement(number));
}

function decimalHexTwosComplement(decimal) {
  var size = 4;

  if (decimal >= 0) {
    var hexadecimal = decimal.toString(16);

    while ((hexadecimal.length % size) != 0) {
      hexadecimal = "" + 0 + hexadecimal;
    }

    return hexadecimal;
  } else {
    var hexadecimal = Math.abs(decimal).toString(16);
    while ((hexadecimal.length % size) != 0) {
      hexadecimal = "" + 0 + hexadecimal;
    }

    var output = '';
    for (i = 0; i < hexadecimal.length; i++) {
      output += (0x0F - parseInt(hexadecimal[i], 16)).toString(16);
    }

    output = (0x01 + parseInt(output, 16)).toString(16);
    return output;
  }
}
function hexToBytes(hex) {
  for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
}
function changeEndianness(string) {

  var result = [];
  let len = string.length - 2;
  while (len >= 0) {
    result.push(string.substr(len, 2));
    len -= 2;
  }
  return result.join('');
}
function setHexValue(value) {
  writeCharacteristic(hexToBytes(value));
}
function setValue(value) {
  writeCharacteristic(value);
}
function setRed() {
  setValue(preset_red);
}

function setGreen() {
  setValue(preset_green);
}

function setBlue() {
  setValue(preset_blue);
}

function setYellow() {
  setValue(preset_yellow);
}

function setCyan() {
  setValue(preset_cyan);
}

function setMagenta() {
  setValue(preset_magenta);
}

function setWhite() {
  setValue(preset_white);
}

function setWhite2() {
  setValue(preset_white2);
}

function setOff() {
  setValue(preset_off);
}
