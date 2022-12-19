import Memory from "./Memory";

type u8 = number;

// TODO: support OBJ
// TODO: support window
// TODO: emulate mid-frame behavior

class PPU {
  memory: Memory;

  clocksToComplete: number = 0;

  constructor(memory: Memory) {
    this.memory = memory;
  }

  updateCanvas() {
    const screen = document.getElementById("screen") as HTMLCanvasElement;
    const ctx = screen.getContext("2d");
    const bg = this.generateBG();
    ctx?.putImageData(bg, -this.memory.SCX, this.memory.SCY);
  }

  // if dataArea is set, then use 0x8800-0x97ff, otherwise use 0x8000-0x8fff
  // if mapArea is set, then use 0x9800-0x9bff, otherwise use 0x9c00-0x9fff
  fetchTile(
    dataArea: boolean,
    mapArea: boolean,
    palette: u8,
    obj: boolean,
    X: number,
    Y: number
  ): ImageData {
    const imageData = new ImageData(8, 8);
    const mapAddr = mapArea ? 0x9800 + (Y * 32 + X) : 0x9c00 + (Y * 32 + X);
    let index = this.memory.readByte(mapAddr);
    if (dataArea && index & (1 << 7)) index |= 0xff00; // sign extension
    index = (index << 4) & 0xffff;
    const dataAddr = dataArea
      ? (0x9000 + index) & 0xffff
      : (0x9c00 + index) & 0xffff;
    for (let y = 0; y < 8; y++) {
      const lower = this.memory.readByte(dataAddr + y * 2);
      const upper = this.memory.readByte(dataAddr + y * 2 + 1);
      for (let x = 0; x < 8; x++) {
        const colorIndex = (((upper >> x) & 1) << 1) + ((lower >> x) & 1);
        // transparent
        if (obj && colorIndex === 0) {
          imageData.data[(y * 8 + x) * 4 + 3] = 0;
          continue;
        }
        const color =
          (((palette >> (colorIndex * 2 + 1)) & 1) << 1) +
          ((palette >> (colorIndex * 2)) & 1);
        // white
        if (color === 0) {
          imageData.data[(y * 8 + x) * 4 + 0] = 255;
          imageData.data[(y * 8 + x) * 4 + 1] = 255;
          imageData.data[(y * 8 + x) * 4 + 2] = 255;
          imageData.data[(y * 8 + x) * 4 + 3] = 255;
        }
        // light gray
        if (color === 1) {
          imageData.data[(y * 8 + x) * 4 + 0] = 170;
          imageData.data[(y * 8 + x) * 4 + 1] = 170;
          imageData.data[(y * 8 + x) * 4 + 2] = 170;
          imageData.data[(y * 8 + x) * 4 + 3] = 255;
        }
        // dark gray
        if (color === 2) {
          imageData.data[(y * 8 + x) * 4 + 0] = 85;
          imageData.data[(y * 8 + x) * 4 + 1] = 85;
          imageData.data[(y * 8 + x) * 4 + 2] = 85;
          imageData.data[(y * 8 + x) * 4 + 3] = 255;
        }
        // black
        if (color === 3) {
          imageData.data[(y * 8 + x) * 4 + 0] = 0;
          imageData.data[(y * 8 + x) * 4 + 1] = 0;
          imageData.data[(y * 8 + x) * 4 + 2] = 0;
          imageData.data[(y * 8 + x) * 4 + 3] = 255;
        }
      }
    }
    return imageData;
  }

  generateBG(): ImageData {
    const imageData = new ImageData(256, 256);
    // set all pixels to white
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const index = y * 256 + x;
        imageData.data[index * 4] = 255;
        imageData.data[index * 4 + 1] = 255;
        imageData.data[index * 4 + 2] = 255;
        imageData.data[index * 4 + 3] = 255;
      }
    }
    if ((this.memory.LCDC & 1) === 0) {
      return imageData;
    }
    const dataArea = ((this.memory.LCDC >> 4) & 1) === 0;
    const mapArea = ((this.memory.LCDC >> 3) & 1) === 0;
    for (let Y = 0; Y < 32; Y++) {
      for (let X = 0; X < 32; X++) {
        const palette = this.memory.BGP;
        const tile = this.fetchTile(dataArea, mapArea, palette, false, X, Y);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            for (let k = 0; k < 4; k++) {
              imageData.data[((Y * 8 + y) * 256 + (X * 8 + x)) * 4 + k] =
                tile.data[(y * 8 + x) * 4 + k];
            }
          }
        }
      }
    }
    return imageData;
  }

  tick() {
    const enableLCD = this.memory.LCDC >> 7 !== 0;
    if (!enableLCD) {
      return;
    }
    this.clocksToComplete--;
    if (this.clocksToComplete === 0) {
      const mode = this.memory.STAT & 0x3;
      if (mode === 2) {
        // OAM SCAN
        this.memory.STAT = this.memory.STAT - mode + 3;
        this.clocksToComplete = 172;
      } else if (mode === 3) {
        // DRAWING PIXELS
        console.log("update canvas!");
        this.updateCanvas();
        this.memory.STAT = this.memory.STAT - mode;
        this.clocksToComplete = 204;
        // when HBLANK interrupt is enabled
        if (this.memory.STAT & (1 << 3)) {
          this.memory.IF |= 1 << 1;
        }
      } else if (mode === 0) {
        // HBLANK
        this.memory.LY = this.memory.LY + 1;
        if (this.memory.LY === 144) {
          this.memory.STAT = this.memory.STAT - mode + 1;
          this.clocksToComplete = 456;
          // when VBLANK interrupt is enabled
          if (this.memory.STAT & (1 << 4)) {
            this.memory.IF |= 1;
          }
        } else {
          this.memory.STAT = this.memory.STAT - mode + 2;
          this.clocksToComplete = 80;
          // when OAM interrupt is enabled
          if (this.memory.STAT & (1 << 5)) {
            this.memory.IF |= 1 << 1;
          }
        }
      } else {
        // VBLANK
        if (this.memory.LY === 154) {
          this.memory.LY = 0;
          this.memory.STAT = this.memory.STAT - mode + 2;
          this.clocksToComplete = 80;
          // when OAM interrupt is enabled
          if (this.memory.STAT & (1 << 5)) {
            this.memory.IF |= 1 << 1;
          }
        } else {
          this.memory.LY = this.memory.LY + 1;
          this.clocksToComplete = 456;
        }
        // when LYC=LY Flag is set and LYC=LY interrupt is enabled
        if (this.memory.STAT & (1 << 2) && this.memory.STAT & (1 << 6)) {
          this.memory.IF |= 1 << 1;
        }
      }
    }
  }
}

export default PPU;
