type u8 = number;
type u16 = number;

class Memory {
  IF: u8 = 0; // mapped to 0xFF0F
  IE: u8 = 0; // mapped to 0xFFFF

  readByte(addr: u16): u8 {
    return 0;
  }

  writeByte(addr: u16, val: u8) {}
}

export default Memory;
