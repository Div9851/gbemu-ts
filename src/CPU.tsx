import Memory from "./Memory";

type u8 = number;
type u16 = number;

class Registers {
  [key: string]: any;

  A: u8 = 0;
  B: u8 = 0;
  C: u8 = 0;
  D: u8 = 0;
  E: u8 = 0;
  F: u8 = 0;
  H: u8 = 0;
  L: u8 = 0;
  PC: u16 = 0;
  SP: u16 = 0;

  incPC(): u16 {
    const curPC = this.PC;
    this.PC = (curPC + 1) & 0xffff;
    return curPC;
  }

  incHL(): u16 {
    const curHL = this.HL;
    this.HL = (curHL + 1) & 0xffff;
    return curHL;
  }

  decHL(): u16 {
    const curHL = this.HL;
    this.HL = (curHL - 1) & 0xffff;
    return curHL;
  }

  incSP(): u16 {
    const curSP = this.SP;
    this.SP = (curSP + 1) & 0xffff;
    return curSP;
  }

  decSP(): u16 {
    const curSP = this.SP;
    this.SP = (curSP - 1) & 0xffff;
    return curSP;
  }

  // The Gameboy can combine two registers in order to
  // read and write 16-bit values.
  // The valid combinations are AF, BC, DE and HL.

  get AF(): u16 {
    return (this.A << 8) | this.F;
  }

  set AF(val: u16) {
    this.A = (val >> 8) & 0xff;
    this.F = val & 0xff;
  }

  get BC(): u16 {
    return (this.B << 8) | this.C;
  }

  set BC(val: u16) {
    this.B = (val >> 8) & 0xff;
    this.C = val & 0xff;
  }

  get DE(): u16 {
    return (this.D << 8) | this.E;
  }

  set DE(val: u16) {
    this.D = (val >> 8) & 0xff;
    this.E = val & 0xff;
  }

  get HL(): u16 {
    return (this.H << 8) | this.L;
  }

  set HL(val: u16) {
    this.H = (val >> 8) & 0xff;
    this.L = val & 0xff;
  }

  // The F register is a special register because
  // it contains the values of 4 flags that allow
  // the CPU to track certain states.
  // These flags are:
  // Z: Zero flag        (bit position 7)
  // N: Subtraction flag (bit position 6)
  // H: Half carry flag  (bit position 5)
  // C: Carry flag       (bit position 4)
  //
  // Bits 3, 2, 1 and 0 are always zero.

  get FlagZ(): boolean {
    return (this.F & (1 << 7)) !== 0;
  }

  set FlagZ(val: boolean) {
    if (val) {
      this.F |= 1 << 7;
    } else {
      this.F &= 0xff - (1 << 7);
    }
  }

  get FlagN(): boolean {
    return (this.F & (1 << 6)) !== 0;
  }

  set FlagN(val: boolean) {
    if (val) {
      this.F |= 1 << 6;
    } else {
      this.F &= 0xff - (1 << 6);
    }
  }

  get FlagH(): boolean {
    return (this.F & (1 << 5)) !== 0;
  }

  set FlagH(val: boolean) {
    if (val) {
      this.F |= 1 << 5;
    } else {
      this.F &= 0xff - (1 << 5);
    }
  }

  get FlagC(): boolean {
    return (this.F & (1 << 4)) !== 0;
  }

  set FlagC(val: boolean) {
    if (val) {
      this.F |= 1 << 4;
    } else {
      this.F &= 0xff - (1 << 4);
    }
  }
}

class Opcode {
  label: string;
  clocks: number;
  handler: () => void;

  constructor(label: string, clocks: number, handler: () => void) {
    this.label = label;
    this.clocks = clocks;
    this.handler = handler;
  }
}

const createOpcodeTable = (reg: Registers, memory: Memory): Array<Opcode> => {
  const opcodeTable: Array<Opcode> = [];

  const label8 = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
  const label16 = ["BC", "DE", "HL", "SP"];

  // 8-bit load instructions

  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const opcode = 0x40 + (x << 3) + y;
      if (x === 6 && y === 6) {
        // opcode 0b01110110 is HALT.
        continue;
      }
      if (x === 6) {
        // LD (HL), r
        opcodeTable[opcode] = new Opcode(`LD (HL), ${label8[y]}`, 8, () => {
          memory.writeByte(reg.HL, reg[label8[y]]);
        });
      } else if (y === 6) {
        // LD r, (HL)
        opcodeTable[opcode] = new Opcode(`LD ${label8[x]}, (HL)`, 8, () => {
          reg[label8[x]] = memory.readByte(reg.HL);
        });
      } else {
        // LD r, r'
        opcodeTable[opcode] = new Opcode(
          `LD ${label8[x]}, ${label8[y]}`,
          4,
          () => {
            reg[label8[x]] = reg[label8[y]];
          }
        );
      }
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x06 + (x << 3);
    if (x === 6) {
      opcodeTable[opcode] = new Opcode(`LD (HL), n`, 12, () => {
        const n = memory.readByte(reg.incPC());
        memory.writeByte(reg.HL, n);
      });
    } else {
      opcodeTable[opcode] = new Opcode(`LD ${label8[x]}, n`, 8, () => {
        const n = memory.readByte(reg.incPC());
        reg[label8[x]] = n;
      });
    }
  }
  opcodeTable[0x0a] = new Opcode(`LD A, (BC)`, 8, () => {
    reg.A = memory.readByte(reg.BC);
  });
  opcodeTable[0x1a] = new Opcode(`LD A, (DE)`, 8, () => {
    reg.A = memory.readByte(reg.DE);
  });
  opcodeTable[0x02] = new Opcode(`LD (BC), A`, 8, () => {
    memory.writeByte(reg.BC, reg.A);
  });
  opcodeTable[0x12] = new Opcode(`LD (DE), A`, 8, () => {
    memory.writeByte(reg.DE, reg.A);
  });
  opcodeTable[0xfa] = new Opcode(`LD A, (nn)`, 16, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 3) + lower;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xea] = new Opcode(`LD (nn), A`, 16, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 3) + lower;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0xf2] = new Opcode(`LDH A, (C)`, 8, () => {
    const addr = 0xff00 + reg.C;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xe2] = new Opcode(`LDH (C), A`, 8, () => {
    const addr = 0xff00 + reg.C;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0xf0] = new Opcode(`LDH A, (n)`, 12, () => {
    const n = memory.readByte(reg.incPC());
    const addr = 0xff00 + n;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xe0] = new Opcode(`LDH (n), A`, 12, () => {
    const n = memory.readByte(reg.incPC());
    const addr = 0xff00 + n;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0x3a] = new Opcode(`LD A, (HL-)`, 8, () => {
    reg.A = memory.readByte(reg.decHL());
  });
  opcodeTable[0x32] = new Opcode(`LD (HL-), A`, 8, () => {
    memory.writeByte(reg.decHL(), reg.A);
  });
  opcodeTable[0x2a] = new Opcode(`LD A, (HL+)`, 8, () => {
    reg.A = memory.readByte(reg.incHL());
  });
  opcodeTable[0x22] = new Opcode(`LD (HL+), A`, 8, () => {
    memory.writeByte(reg.incHL(), reg.A);
  });

  // 16-bit load instructions

  for (let x = 0; x < 4; x++) {
    const opcode = 0x01 + (x << 4);
    opcodeTable[opcode] = new Opcode(`LD ${label16[x]}, nn`, 12, () => {
      const lower = memory.readByte(reg.incPC());
      const upper = memory.readByte(reg.incPC());
      const n = (upper << 3) + lower;
      reg[label16[x]] = n;
    });
  }
  opcodeTable[0x08] = new Opcode(`LD (nn), SP`, 20, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 3) + lower;
    const lowerSP = reg.SP & 0xff;
    const upperSP = (reg.SP >> 8) & 0xff;
    memory.writeByte(addr, lowerSP);
    memory.writeByte(addr, upperSP);
  });
  opcodeTable[0xf9] = new Opcode(`LD SP, HL`, 8, () => {
    reg.SP = reg.HL;
  });
  for (let x = 0; x < 4; x++) {
    const opcode = 0xc5 + (x << 4);
    opcodeTable[opcode] = new Opcode(`PUSH ${label16[x]}`, 16, () => {
      reg.decSP();
      memory.writeByte(reg.decSP(), reg.B);
      memory.writeByte(reg.SP, reg.C);
    });
  }
  for (let x = 0; x < 4; x++) {
    const opcode = 0xc1 + (x << 4);
    opcodeTable[opcode] = new Opcode(`POP ${label16[x]}`, 12, () => {
      reg.C = memory.readByte(reg.incSP());
      reg.B = memory.readByte(reg.incSP());
    });
  }

  return opcodeTable;
};

class CPU {
  reg: Registers;
  memory: Memory;
  clocksToComplete: number;
  opcodeTable: Array<Opcode>;

  constructor(memory: Memory) {
    this.reg = new Registers();
    this.memory = memory;
    this.clocksToComplete = 0;
    this.opcodeTable = createOpcodeTable(this.reg, this.memory);
  }

  tick() {}
}

export default CPU;
