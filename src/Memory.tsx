type u8 = number;
type u16 = number;

// memory map
// 0000-3fff 16 KB ROM bank 00
// 4000-7fff 16 KB ROM bank xx
// 8000-9fff 8 KB Video RAM (VRAM)
// a000-bfff 8 KB External RAM
// c000-cfff 4 KB Work RAM (WRAM)
// d000-dfff 4 KB Work RAM (WRAM)
// e000-fdff Mirror of c000-ddff
// fe00-fe9f Sprite Attribute Table (OAM)
// fea0-feff not usable
// ff00-ff7f I/O Registers
// ff80-fffe High RAM
// ffff-ffff Interrupt Enable Register (IE)

// VRAM map
// 8000-87ff Tile set #1: tiles 0-127
// 8800-8fff Tile set #1: tiles 128-255 / Tile set #0: tiles -1 to -128
// 9000-97ff Tile set #0: tiles 0-127
// 9800-9bff Tile map #0
// 9c00-9fff Tile map #1

class Memory {
  data: Uint8Array = new Uint8Array(64 * 1024);

  // I/O Registers

  LCDC: u8 = 0x91; // mapped to 0xff40
  STAT: u8 = 0x81; // mapped to 0xff41
  SCY: u8 = 0x00; // mapped to 0xff42
  SCX: u8 = 0x00; // mapped to 0xff43
  set LY(val: u8) {
    // mapped to 0xff44
    if (val === this.LYC) {
      this.STAT |= 1 << 2;
    } else {
      this.STAT &= 0xff - (1 << 2);
    }
  }
  set LYC(val: u8) {
    // mapped to 0xff45
    if (val === this.LY) {
      this.STAT |= 1 << 2;
    } else {
      this.STAT &= 0xff - (1 << 2);
    }
  }
  BGP: u8 = 0xfc; // mapped to 0xff47
  OBP0: u8 = 0x00; // mapped to 0xff48
  OBP1: u8 = 0x00; // mapped to 0xff49
  WY: u8 = 0x00; // mapped to 0xff4a
  WX: u8 = 0x00; // mapped to 0xff4b
  IF: u8 = 0x00; // mapped to 0xff0f

  IE: u8 = 0x00; // mapped to 0xffff

  constructor() {
    this.LY = 0x91;
    this.LYC = 0x00;
  }

  readByte(addr: u16): u8 {
    if (addr === 0xff40) return this.LCDC;
    if (addr === 0xff41) return this.STAT;
    if (addr === 0xff42) return this.SCY;
    if (addr === 0xff43) return this.SCX;
    if (addr === 0xff44) return this.LY;
    if (addr === 0xff45) return this.LYC;
    if (addr === 0xff47) return this.BGP;
    if (addr === 0xff48) return this.OBP0;
    if (addr === 0xff49) return this.OBP1;
    if (addr === 0xff4a) return this.WY;
    if (addr === 0xff4b) return this.WX;
    if (addr === 0xff0f) return this.IF;

    if (addr === 0xffff) return this.IE;

    return this.data[addr];
  }

  writeByte(addr: u16, val: u8) {
    if (addr === 0xff40) {
      this.LCDC = val;
      return;
    }
    if (addr === 0xff41) {
      this.STAT = val;
      return;
    }
    if (addr === 0xff42) {
      this.SCY = val;
      return;
    }
    if (addr === 0xff43) {
      this.SCX = val;
      return;
    }
    if (addr === 0xff44) {
      this.LY = val;
      return;
    }
    if (addr === 0xff45) {
      this.LYC = val;
      return;
    }
    if (addr === 0xff47) {
      this.BGP = val;
      return;
    }
    if (addr === 0xff48) {
      this.OBP0 = val;
      return;
    }
    if (addr === 0xff49) {
      this.OBP1 = val;
      return;
    }
    if (addr === 0xff4a) {
      this.WY = val;
      return;
    }
    if (addr === 0xff4b) {
      this.WX = val;
      return;
    }
    if (addr === 0xff0f) {
      this.IF = val;
      return;
    }

    if (addr === 0xffff) {
      this.IE = val;
      return;
    }

    // Serial transfer data (for debug)
    if (addr === 0xff01) {
      console.log(`SERIAL: ${val}`);
      return;
    }

    this.data[addr] = val;
  }
}

export default Memory;
