import Memory from "./Memory";

type u8 = number;
type u16 = number;

class Registers {
  [key: string]: any;

  A: u8 = 0x01;
  B: u8 = 0xff;
  C: u8 = 0x13;
  D: u8 = 0x00;
  E: u8 = 0xc1;
  F: u8 = 0x00;
  H: u8 = 0x84;
  L: u8 = 0x03;
  PC: u16 = 0x0000;
  SP: u16 = 0xfffe;
  IME: boolean = false;

  jump: boolean = false;
  clocksToCompleteJump: number = 0;
  jumpHandler: () => void = () => {};

  halt: boolean = false;
  notIncPC: boolean = false;

  outputLog: boolean = false;

  incPC(): u16 {
    const curPC = this.PC;
    if (this.notIncPC) {
      this.notIncPC = false;
    } else {
      this.PC = (curPC + 1) & 0xffff;
    }
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

class Instruction {
  opcode: u8;
  label: string;
  clocks: number;
  length: number;
  handler: () => void;

  constructor(
    opcode: u8,
    label: string,
    clocks: number,
    length: number,
    handler: () => void
  ) {
    this.opcode = opcode;
    this.label = label;
    this.clocks = clocks;
    this.length = length;
    this.handler = handler;
  }
}

const add8 = (x: u8, y: u8, reg: Registers): u8 => {
  const result = (x + y) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = (x & 0xf) + (y & 0xf) > 0xf;
  reg.FlagC = x + y > 0xff;
  return result;
};

const sub8 = (x: u8, y: u8, reg: Registers): u8 => {
  const result = (x - y) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = true;
  reg.FlagH = (x & 0xf) < (y & 0xf);
  reg.FlagC = x < y;
  return result;
};

const adc8 = (x: u8, y: u8, reg: Registers): u8 => {
  const c = reg.FlagC ? 1 : 0;
  const result = (x + y + c) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = (x & 0xf) + (y & 0xf) + c > 0xf;
  reg.FlagC = x + y + c > 0xff;
  return result;
};

const sbc8 = (x: u8, y: u8, reg: Registers): u8 => {
  const c = reg.FlagC ? 0xff : 0;
  const result = (x - y - c) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = true;
  reg.FlagH = (x & 0xf) < (y & 0xf) + c;
  reg.FlagC = x < y + c;
  return result;
};

const and8 = (x: u8, y: u8, reg: Registers): u8 => {
  const result = x & y;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = true;
  reg.FlagC = false;
  return result;
};

const xor8 = (x: u8, y: u8, reg: Registers): u8 => {
  const result = x ^ y;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = false;
  reg.FlagC = false;
  return result;
};

const or8 = (x: u8, y: u8, reg: Registers): u8 => {
  const result = x | y;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = false;
  reg.FlagC = false;
  return result;
};

const inc8 = (x: u8, reg: Registers): u8 => {
  const result = (x + 1) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = false;
  reg.FlagH = (x & 0xf) + 1 > 0xf;
  return result;
};

const dec8 = (x: u8, reg: Registers): u8 => {
  const result = (x - 1) & 0xff;
  reg.FlagZ = result === 0;
  reg.FlagN = true;
  reg.FlagH = (x & 0xf) < 1;
  return result;
};

const label8 = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
const label16 = ["BC", "DE", "HL", "SP"];

const createOpcodeTable = (
  reg: Registers,
  memory: Memory
): Array<Instruction> => {
  const opcodeTable: Array<Instruction> = [];

  opcodeTable[0xcb] = new Instruction(0xcb, `PREFIX`, 0, 0, () => {});

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
        opcodeTable[opcode] = new Instruction(
          opcode,
          `LD (HL), ${label8[y]}`,
          8,
          1,
          () => {
            memory.writeByte(reg.HL, reg[label8[y]]);
          }
        );
      } else if (y === 6) {
        // LD r, (HL)
        opcodeTable[opcode] = new Instruction(
          opcode,
          `LD ${label8[x]}, (HL)`,
          8,
          1,
          () => {
            reg[label8[x]] = memory.readByte(reg.HL);
          }
        );
      } else {
        // LD r, r'
        opcodeTable[opcode] = new Instruction(
          opcode,
          `LD ${label8[x]}, ${label8[y]}`,
          4,
          1,
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
      opcodeTable[opcode] = new Instruction(opcode, `LD (HL), n`, 12, 2, () => {
        const n = memory.readByte(reg.incPC());
        memory.writeByte(reg.HL, n);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `LD ${label8[x]}, n`,
        8,
        2,
        () => {
          const n = memory.readByte(reg.incPC());
          reg[label8[x]] = n;
        }
      );
    }
  }
  opcodeTable[0x0a] = new Instruction(0x0a, `LD A, (BC)`, 8, 1, () => {
    reg.A = memory.readByte(reg.BC);
  });
  opcodeTable[0x1a] = new Instruction(0x1a, `LD A, (DE)`, 8, 1, () => {
    reg.A = memory.readByte(reg.DE);
  });
  opcodeTable[0x02] = new Instruction(0x02, `LD (BC), A`, 8, 1, () => {
    memory.writeByte(reg.BC, reg.A);
  });
  opcodeTable[0x12] = new Instruction(0x12, `LD (DE), A`, 8, 1, () => {
    memory.writeByte(reg.DE, reg.A);
  });
  opcodeTable[0xfa] = new Instruction(0xfa, `LD A, (nn)`, 16, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 8) + lower;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xea] = new Instruction(0xea, `LD (nn), A`, 16, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 8) + lower;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0xf2] = new Instruction(0xf2, `LDH A, (C)`, 8, 1, () => {
    const addr = 0xff00 + reg.C;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xe2] = new Instruction(0xe2, `LDH (C), A`, 8, 1, () => {
    const addr = 0xff00 + reg.C;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0xf0] = new Instruction(0xf0, `LDH A, (n)`, 12, 1, () => {
    const n = memory.readByte(reg.incPC());
    const addr = 0xff00 + n;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xe0] = new Instruction(0xe0, `LDH (n), A`, 12, 2, () => {
    const n = memory.readByte(reg.incPC());
    const addr = 0xff00 + n;
    memory.writeByte(addr, reg.A);
  });
  opcodeTable[0x3a] = new Instruction(0x3a, `LD A, (HL-)`, 8, 1, () => {
    reg.A = memory.readByte(reg.decHL());
  });
  opcodeTable[0x32] = new Instruction(0x32, `LD (HL-), A`, 8, 1, () => {
    memory.writeByte(reg.decHL(), reg.A);
  });
  opcodeTable[0x2a] = new Instruction(0x2a, `LD A, (HL+)`, 8, 1, () => {
    reg.A = memory.readByte(reg.incHL());
  });
  opcodeTable[0x22] = new Instruction(0x22, `LD (HL+), A`, 8, 1, () => {
    memory.writeByte(reg.incHL(), reg.A);
  });

  // 16-bit load instructions

  for (let x = 0; x < 4; x++) {
    const opcode = 0x01 + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `LD ${label16[x]}, nn`,
      12,
      3,
      () => {
        const lower = memory.readByte(reg.incPC());
        const upper = memory.readByte(reg.incPC());
        const n = (upper << 8) + lower;
        reg[label16[x]] = n;
      }
    );
  }
  opcodeTable[0x08] = new Instruction(0x08, `LD (nn), SP`, 20, 3, () => {
    const lowerAddr = memory.readByte(reg.incPC());
    const upperAddr = memory.readByte(reg.incPC());
    const addr = (upperAddr << 8) + lowerAddr;
    const lowerSP = reg.SP & 0xff;
    const upperSP = (reg.SP >> 8) & 0xff;
    memory.writeByte(addr, lowerSP);
    memory.writeByte(addr, upperSP);
  });
  opcodeTable[0xf9] = new Instruction(0xf9, `LD SP, HL`, 8, 1, () => {
    reg.SP = reg.HL;
  });
  for (let x = 0; x < 4; x++) {
    const opcode = 0xc5 + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `PUSH ${label16[x]}`,
      16,
      1,
      () => {
        reg.decSP();
        memory.writeByte(reg.decSP(), reg.B);
        memory.writeByte(reg.SP, reg.C);
      }
    );
  }
  for (let x = 0; x < 4; x++) {
    const opcode = 0xc1 + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `POP ${label16[x]}`,
      12,
      1,
      () => {
        reg.C = memory.readByte(reg.incSP());
        reg.B = memory.readByte(reg.incSP());
      }
    );
  }

  // 8-bit arithmetic/logic instructions

  for (let x = 0; x < 8; x++) {
    const opcode = 0x80 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `ADD A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = add8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `ADD A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = add8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xc6] = new Instruction(0xc6, `ADD A, n`, 8, 2, () => {
    const a = reg.A;
    const b = memory.readByte(reg.incPC());
    reg.A = add8(a, b, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0x88 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `ADC A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = adc8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `ADC A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = adc8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xce] = new Instruction(0xce, `ADC A, n`, 8, 2, () => {
    const a = reg.A;
    const b = memory.readByte(reg.incPC());
    reg.A = adc8(a, b, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0x90 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SUB A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = sub8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SUB A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = sub8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xd6] = new Instruction(0xd6, `SUB A, n`, 8, 2, () => {
    const a = reg.A;
    const b = memory.readByte(reg.incPC());
    reg.A = sub8(a, b, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0x98 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SBC A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = sbc8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SBC A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = sbc8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xde] = new Instruction(0xde, `SBC A, n`, 8, 2, () => {
    const a = reg.A;
    const b = memory.readByte(reg.incPC());
    reg.A = sbc8(a, b, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0xa0 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `AND A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = and8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `AND A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = and8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xe6] = new Instruction(0xe6, `AND A, n`, 8, 1, () => {
    const a = reg.A;
    const n = memory.readByte(reg.incPC());
    reg.A = and8(a, n, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0xa8 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `XOR A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = xor8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `XOR A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = xor8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xee] = new Instruction(0xee, `XOR A, n`, 8, 1, () => {
    const a = reg.A;
    const n = memory.readByte(reg.incPC());
    reg.A = xor8(a, n, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0xb0 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `OR A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        reg.A = or8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `OR A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          reg.A = or8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xf6] = new Instruction(0xf6, `OR A, n`, 8, 1, () => {
    const a = reg.A;
    const n = memory.readByte(reg.incPC());
    reg.A = or8(a, n, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0xb8 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `CP A, (HL)`, 8, 1, () => {
        const a = reg.A;
        const b = memory.readByte(reg.HL);
        sub8(a, b, reg);
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `CP A, ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg.A;
          const b = reg[label8[x]];
          sub8(a, b, reg);
        }
      );
    }
  }
  opcodeTable[0xfe] = new Instruction(0xfe, `CP A, n`, 8, 1, () => {
    const a = reg.A;
    const n = memory.readByte(reg.incPC());
    sub8(a, n, reg);
  });
  for (let x = 0; x < 8; x++) {
    const opcode = 0x04 + (x << 3);
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `INC (HL)`, 12, 1, () => {
        const a = memory.readByte(reg.HL);
        memory.writeByte(reg.HL, inc8(a, reg));
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `INC ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg[label8[x]];
          reg[label8[x]] = inc8(a, reg);
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x05 + (x << 3);
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `DEC (HL)`, 12, 1, () => {
        const a = memory.readByte(reg.HL);
        memory.writeByte(reg.HL, dec8(a, reg));
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `DEC ${label8[x]}`,
        4,
        1,
        () => {
          const a = reg[label8[x]];
          reg[label8[x]] = dec8(a, reg);
        }
      );
    }
  }
  opcodeTable[0x27] = new Instruction(0x27, `DAA`, 4, 1, () => {
    if (reg.FlagH || (reg.A & 0xf) >= 0xa) {
      reg.A += 0x6;
      if (reg.A > 0xff) {
        reg.A &= 0xff;
        reg.FlagC = true;
      }
    }
    if (reg.FlagC || ((reg.A >> 4) & 0xf) >= 0xa) {
      reg.A += 0x60;
      if (reg.A > 0xff) {
        reg.A &= 0xff;
        reg.FlagC = true;
      }
    }
    reg.FlagZ = reg.A === 0;
    reg.FlagH = false;
  });
  opcodeTable[0x2f] = new Instruction(0x2f, `CPL`, 4, 1, () => {
    reg.A = reg.A ^ 0xff;
    reg.FlagN = true;
    reg.FlagH = true;
  });

  // 16-bit arithmetic/logic instructions

  for (let x = 0; x < 4; x++) {
    const opcode = 0x09 + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `ADD HL, ${label16[x]}`,
      8,
      1,
      () => {
        const lower = label16[x][1];
        const upper = label16[x][0];
        reg.L = add8(reg.L, reg[lower], reg);
        reg.H = adc8(reg.H, reg[upper], reg);
      }
    );
  }
  opcodeTable[0xe8] = new Instruction(0xe8, `ADD SP, n`, 16, 2, () => {
    const n = memory.readByte(reg.incPC());
    add8(reg.SP & 0xff, n, reg);
    reg.FlagZ = false;
    reg.FlagN = false;
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    reg.SP = (reg.SP + m) & 0xffff;
  });
  for (let x = 0; x < 4; x++) {
    const opcode = 0x03 + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `INC ${label16[x]}`,
      8,
      1,
      () => {
        reg[label16[x]] = (reg[label16[x]] + 1) & 0xffff;
      }
    );
  }
  for (let x = 0; x < 4; x++) {
    const opcode = 0x0b + (x << 4);
    opcodeTable[opcode] = new Instruction(
      opcode,
      `DEC ${label16[x]}`,
      8,
      1,
      () => {
        reg[label16[x]] = (reg[label16[x]] - 1) & 0xffff;
      }
    );
  }
  opcodeTable[0xf8] = new Instruction(0xe8, `LD HL, SP+n`, 12, 2, () => {
    const n = memory.readByte(reg.incPC());
    add8(reg.SP & 0xff, n, reg);
    reg.FlagZ = false;
    reg.FlagN = false;
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    reg.HL = (reg.SP + m) & 0xffff;
  });

  // rotate and shift instructions

  opcodeTable[0x07] = new Instruction(0x07, `RLCA`, 4, 1, () => {
    const a = reg.A;
    reg.A = ((a << 1) & 0xff) + (a >> 7);
    reg.FlagZ = false;
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = a >> 7 !== 0;
  });
  opcodeTable[0x17] = new Instruction(0x17, `RLA`, 4, 1, () => {
    const c = reg.FlagC ? 1 : 0;
    const a = reg.A;
    reg.A = ((a << 1) & 0xff) + c;
    reg.FlagZ = false;
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = a >> 7 !== 0;
  });
  opcodeTable[0x0f] = new Instruction(0x0f, `RRCA`, 4, 1, () => {
    const a = reg.A;
    reg.A = (a >> 1) + ((a & 1) << 7);
    reg.FlagZ = false;
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = (a & 1) !== 0;
  });
  opcodeTable[0x1f] = new Instruction(0x1f, `RRA`, 4, 1, () => {
    const c = reg.FlagC ? 1 : 0;
    const a = reg.A;
    reg.A = (a >> 1) + (c << 7);
    reg.FlagZ = false;
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = (a & 1) !== 0;
  });

  // jump instructions

  opcodeTable[0xc3] = new Instruction(0xc3, `JP nn`, 16, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const n = (upper << 8) + lower;
    reg.PC = n;
  });
  opcodeTable[0xe9] = new Instruction(0xe9, `JP HL`, 4, 1, () => {
    reg.PC = reg.HL;
  });
  opcodeTable[0xc2] = new Instruction(0xc2, `JP NZ, nn`, 12, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const n = (upper << 8) + lower;
    if (!reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xca] = new Instruction(0xca, `JP Z, nn`, 12, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const n = (upper << 8) + lower;
    if (reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xd2] = new Instruction(0xd2, `JP NC, nn`, 12, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const n = (upper << 8) + lower;
    if (!reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xda] = new Instruction(0xda, `JP C, nn`, 12, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const n = (upper << 8) + lower;
    if (reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = n;
      };
    }
  });
  opcodeTable[0x18] = new Instruction(0x18, `JR PC+n`, 12, 2, () => {
    const n = memory.readByte(reg.incPC());
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    reg.PC = (reg.PC + m) & 0xffff;
  });
  opcodeTable[0x20] = new Instruction(0x20, `JR NZ, PC+n`, 8, 2, () => {
    const n = memory.readByte(reg.incPC());
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    if (!reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = (reg.PC + m) & 0xffff;
      };
    }
  });
  opcodeTable[0x28] = new Instruction(0x28, `JR Z, PC+n`, 8, 2, () => {
    const n = memory.readByte(reg.incPC());
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    if (reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = (reg.PC + m) & 0xffff;
      };
    }
  });
  opcodeTable[0x30] = new Instruction(0x30, `JR NC, PC+n`, 8, 2, () => {
    const n = memory.readByte(reg.incPC());
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    if (!reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = (reg.PC + m) & 0xffff;
      };
    }
  });
  opcodeTable[0x38] = new Instruction(0x38, `JR C, PC+n`, 8, 2, () => {
    const n = memory.readByte(reg.incPC());
    const m = n & (1 << 7) ? n + 0xff00 : n; // sign extension
    if (reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 4;
      reg.jumpHandler = () => {
        reg.PC = (reg.PC + m) & 0xffff;
      };
    }
  });
  opcodeTable[0xcd] = new Instruction(0xcd, `CALL nn`, 24, 3, () => {
    const lowerN = memory.readByte(reg.incPC());
    const upperN = memory.readByte(reg.incPC());
    const n = (upperN << 8) + lowerN;
    const lowerPC = reg.PC & 0xff;
    const upperPC = (reg.PC >> 8) & 0xff;
    reg.decSP();
    memory.writeByte(reg.decSP(), upperPC);
    memory.writeByte(reg.SP, lowerPC);
    reg.PC = n;
  });
  opcodeTable[0xc4] = new Instruction(0xc4, `CALL NZ, nn`, 12, 3, () => {
    const lowerN = memory.readByte(reg.incPC());
    const upperN = memory.readByte(reg.incPC());
    const n = (upperN << 8) + lowerN;
    const lowerPC = reg.PC & 0xff;
    const upperPC = (reg.PC >> 8) & 0xff;
    if (!reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        reg.decSP();
        memory.writeByte(reg.decSP(), upperPC);
        memory.writeByte(reg.SP, lowerPC);
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xcc] = new Instruction(0xcc, `CALL Z, nn`, 12, 3, () => {
    const lowerN = memory.readByte(reg.incPC());
    const upperN = memory.readByte(reg.incPC());
    const n = (upperN << 8) + lowerN;
    const lowerPC = reg.PC & 0xff;
    const upperPC = (reg.PC >> 8) & 0xff;
    if (reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        reg.decSP();
        memory.writeByte(reg.decSP(), upperPC);
        memory.writeByte(reg.SP, lowerPC);
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xd4] = new Instruction(0xd4, `CALL NC, nn`, 12, 3, () => {
    const lowerN = memory.readByte(reg.incPC());
    const upperN = memory.readByte(reg.incPC());
    const n = (upperN << 8) + lowerN;
    const lowerPC = reg.PC & 0xff;
    const upperPC = (reg.PC >> 8) & 0xff;
    if (!reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        reg.decSP();
        memory.writeByte(reg.decSP(), upperPC);
        memory.writeByte(reg.SP, lowerPC);
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xdc] = new Instruction(0xc4, `CALL C, nn`, 12, 3, () => {
    const lowerN = memory.readByte(reg.incPC());
    const upperN = memory.readByte(reg.incPC());
    const n = (upperN << 8) + lowerN;
    const lowerPC = reg.PC & 0xff;
    const upperPC = (reg.PC >> 8) & 0xff;
    if (reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        reg.decSP();
        memory.writeByte(reg.decSP(), upperPC);
        memory.writeByte(reg.SP, lowerPC);
        reg.PC = n;
      };
    }
  });
  opcodeTable[0xc9] = new Instruction(0xc9, `RET`, 16, 1, () => {
    const lower = memory.readByte(reg.incSP());
    const upper = memory.readByte(reg.incSP());
    const addr = (upper << 8) + lower;
    reg.PC = addr;
  });
  opcodeTable[0xc0] = new Instruction(0xc0, `RET NZ`, 8, 1, () => {
    if (!reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        const lower = memory.readByte(reg.incSP());
        const upper = memory.readByte(reg.incSP());
        const addr = (upper << 8) + lower;
        reg.PC = addr;
      };
    }
  });
  opcodeTable[0xc8] = new Instruction(0xc8, `RET Z`, 8, 1, () => {
    if (reg.FlagZ) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        const lower = memory.readByte(reg.incSP());
        const upper = memory.readByte(reg.incSP());
        const addr = (upper << 8) + lower;
        reg.PC = addr;
      };
    }
  });
  opcodeTable[0xd0] = new Instruction(0xd0, `RET NC`, 8, 1, () => {
    if (!reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        const lower = memory.readByte(reg.incSP());
        const upper = memory.readByte(reg.incSP());
        const addr = (upper << 8) + lower;
        reg.PC = addr;
      };
    }
  });
  opcodeTable[0xd8] = new Instruction(0xd8, `RET C`, 8, 1, () => {
    if (reg.FlagC) {
      reg.jump = true;
      reg.clocksToCompleteJump = 12;
      reg.jumpHandler = () => {
        const lower = memory.readByte(reg.incSP());
        const upper = memory.readByte(reg.incSP());
        const addr = (upper << 8) + lower;
        reg.PC = addr;
      };
    }
  });
  opcodeTable[0xd9] = new Instruction(0xd9, `RETI`, 16, 1, () => {
    const lower = memory.readByte(reg.incSP());
    const upper = memory.readByte(reg.incSP());
    const addr = (upper << 8) + lower;
    reg.PC = addr;
    reg.IME = true;
  });
  for (let x = 0; x < 8; x++) {
    const y = x << 3;
    const opcode = 0xc7 + y;
    opcodeTable[opcode] = new Instruction(
      opcode,
      `RST 0x${y.toString(16)}`,
      16,
      1,
      () => {
        const lower = reg.PC & 0xff;
        const upper = (reg.PC >> 8) & 0xff;
        reg.decSP();
        memory.writeByte(reg.decSP(), upper);
        memory.writeByte(reg.SP, lower);
        reg.PC = y;
      }
    );
  }

  // CPU control instructions

  opcodeTable[0x3f] = new Instruction(0x3f, `CCF`, 4, 1, () => {
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = !reg.FlagC;
  });
  opcodeTable[0x37] = new Instruction(0x37, `SCF`, 4, 1, () => {
    reg.FlagN = false;
    reg.FlagH = false;
    reg.FlagC = true;
  });
  opcodeTable[0x00] = new Instruction(0x00, `NOP`, 4, 1, () => {});
  opcodeTable[0x76] = new Instruction(0x76, `HALT`, 4, 1, () => {
    if (!reg.IME && (memory.IE & memory.IF) !== 0) {
      // HALT mode is not entered. HALT bug occurs.
      reg.notIncPC = true;
    } else {
      reg.halt = true;
    }
  });
  opcodeTable[0xf3] = new Instruction(0xf3, `DI`, 4, 1, () => {
    reg.IME = false;
  });
  opcodeTable[0xfb] = new Instruction(0xf3, `EI`, 4, 1, () => {
    reg.IME = true;
  });

  return opcodeTable;
};

const createPrefixedOpcodeTable = (
  reg: Registers,
  memory: Memory
): Array<Instruction> => {
  const opcodeTable: Array<Instruction> = [];

  // rotate and shift instructions

  for (let x = 0; x < 8; x++) {
    const opcode = x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `RLC (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = ((a << 1) & 0xff) + (a >> 7);
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = a >> 7 !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `RLC ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = ((a << 1) & 0xff) + (a >> 7);
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = a >> 7 !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x10 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `RL (HL)`, 16, 1, () => {
        const c = reg.FlagC ? 1 : 0;
        const a = memory.readByte(reg.HL);
        const result = ((a << 1) & 0xff) + c;
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = a >> 7 !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `RL ${label8[x]}`,
        8,
        1,
        () => {
          const c = reg.FlagC ? 1 : 0;
          const a = reg[label8[x]];
          const result = ((a << 1) & 0xff) + c;
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = a >> 7 !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x08 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `RRC (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = (a >> 1) + ((a & 1) << 7);
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = (a & 1) !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `RRC ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = (a >> 1) + ((a & 1) << 7);
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = (a & 1) !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x18 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `RR (HL)`, 16, 1, () => {
        const c = reg.FlagC ? 1 : 0;
        const a = memory.readByte(reg.HL);
        const result = (a >> 1) + (c << 7);
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = (a & 1) !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `RR ${label8[x]}`,
        8,
        1,
        () => {
          const c = reg.FlagC ? 1 : 0;
          const a = reg[label8[x]];
          const result = (a >> 1) + (c << 7);
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = (a & 1) !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x20 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SLA (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = (a << 1) & 0xff;
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = a >> 7 !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SLA ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = (a << 1) & 0xff;
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = a >> 7 !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x28 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SRA (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = ((a >> 7) << 7) + (a >> 1);
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = (a & 1) !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SRA ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = ((a >> 7) << 7) + (a >> 1);
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = (a & 1) !== 0;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x30 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SWAP (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = ((a & 0xf) << 4) + (a >> 4);
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = false;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SWAP ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = ((a & 0xf) << 4) + (a >> 4);
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = false;
        }
      );
    }
  }
  for (let x = 0; x < 8; x++) {
    const opcode = 0x38 + x;
    if (x === 6) {
      opcodeTable[opcode] = new Instruction(opcode, `SRL (HL)`, 16, 1, () => {
        const a = memory.readByte(reg.HL);
        const result = a >> 1;
        memory.writeByte(reg.HL, result);
        reg.FlagZ = result === 0;
        reg.FlagN = false;
        reg.FlagH = false;
        reg.FlagC = (a & 1) !== 0;
      });
    } else {
      opcodeTable[opcode] = new Instruction(
        opcode,
        `SRL ${label8[x]}`,
        8,
        1,
        () => {
          const a = reg[label8[x]];
          const result = a >> 1;
          reg[label8[x]] = result;
          reg.FlagZ = result === 0;
          reg.FlagN = false;
          reg.FlagH = false;
          reg.FlagC = (a & 1) !== 0;
        }
      );
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let x = 0; x < 8; x++) {
      const opcode = 0x40 + (i << 3) + x;
      if (x === 6) {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `BIT ${i}, (HL)`,
          12,
          1,
          () => {
            const a = memory.readByte(reg.HL);
            reg.FlagZ = ((a >> i) & 1) === 0;
            reg.FlagN = false;
            reg.FlagH = true;
          }
        );
      } else {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `BIT ${i}, ${label8[x]}`,
          8,
          1,
          () => {
            const a = reg[label8[x]];
            reg.FlagZ = ((a >> i) & 1) === 0;
            reg.FlagN = false;
            reg.FlagH = true;
          }
        );
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let x = 0; x < 8; x++) {
      const opcode = 0xc0 + (i << 3) + x;
      if (x === 6) {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `SET ${i}, (HL)`,
          16,
          1,
          () => {
            const a = memory.readByte(reg.HL);
            const result = a | (1 << i);
            memory.writeByte(reg.HL, result);
          }
        );
      } else {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `SET ${i}, ${label8[x]}`,
          8,
          1,
          () => {
            const a = reg[label8[x]];
            const result = a | (1 << i);
            reg[label8[x]] = result;
          }
        );
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let x = 0; x < 8; x++) {
      const opcode = 0x80 + (i << 3) + x;
      if (x === 6) {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `RES ${i}, (HL)`,
          16,
          1,
          () => {
            const a = memory.readByte(reg.HL);
            const result = a & (0xff - (1 << i));
            memory.writeByte(reg.HL, result);
          }
        );
      } else {
        opcodeTable[opcode] = new Instruction(
          opcode,
          `RES ${i}, ${label8[x]}`,
          8,
          1,
          () => {
            const a = reg[label8[x]];
            const result = a & (0xff - (1 << i));
            reg[label8[x]] = result;
          }
        );
      }
    }
  }

  return opcodeTable;
};

class CPU {
  reg: Registers;
  memory: Memory;
  clocksToComplete: number;
  funcToExecute: () => void;
  opcodeTable: Array<Instruction>;
  prefixedOpcodeTable: Array<Instruction>;
  counter: number = 0;

  constructor(memory: Memory) {
    this.reg = new Registers();
    this.memory = memory;
    this.clocksToComplete = 0;
    this.funcToExecute = () => {};
    this.opcodeTable = createOpcodeTable(this.reg, this.memory);
    this.prefixedOpcodeTable = createPrefixedOpcodeTable(this.reg, this.memory);
  }

  fetch() {
    if (this.reg.HL === 0x9ff0) {
      console.log("Wow!");
    }
    if (this.reg.PC === 0x000c) {
      this.reg.outputLog = true;
    }
    let opcode = this.memory.readByte(this.reg.incPC());
    let inst = this.opcodeTable[opcode];
    if (opcode === 0xcb) {
      opcode = this.memory.readByte(this.reg.incPC());
      inst = this.prefixedOpcodeTable[opcode];
    }
    if (this.reg.outputLog) {
      console.log(opcode);
      console.log(inst.label);
    }
    this.clocksToComplete = inst.clocks;
    this.funcToExecute = inst.handler;
    this.reg.jump = false;
  }

  tick() {
    this.counter++;
    if (this.counter === 100) {
      this.counter = 0;
      console.log("one");
    }
    this.clocksToComplete--;
    if (this.clocksToComplete === 0) {
      this.funcToExecute();
      if (this.reg.jump) {
        this.reg.jump = false;
        this.clocksToComplete = this.reg.clocksToCompleteJump;
        this.funcToExecute = this.reg.jumpHandler;
        return;
      }
      // check interrupt
      const interrupt = this.memory.IE & this.memory.IF;
      const intVector = [0x40, 0x48, 0x50, 0x58, 0x60];
      if (interrupt && this.reg.IME) {
        for (let i = 0; i < 5; i++) {
          if (interrupt & (1 << i)) {
            this.clocksToComplete = 20;
            this.funcToExecute = () => {
              this.reg.halt = false;
              this.reg.IME = false;
              const lower = this.reg.PC & 0xff;
              const upper = (this.reg.PC >> 8) & 0xff;
              this.reg.decSP();
              this.memory.writeByte(this.reg.decSP(), upper);
              this.memory.writeByte(this.reg.SP, lower);
              this.reg.PC = intVector[i];
              this.memory.IF ^= 1 << i;
            };
            return;
          }
        }
      }
      if (this.reg.halt) {
        this.clocksToComplete = 4;
        if (interrupt) {
          // if IME=0 and CPU is halted, when any interrupt is triggered,
          // it takes 4 clocks to exit halt, even if CPU doesn't jump to the interrupt vector.
          this.funcToExecute = () => {
            this.reg.halt = false;
            this.reg.notIncPC = true;
          };
        } else {
          this.funcToExecute = () => {};
        }
        return;
      }
      this.fetch();
    }
  }
}

export default CPU;
