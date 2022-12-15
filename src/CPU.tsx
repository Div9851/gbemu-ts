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

const createOpcodeTable = (
  reg: Registers,
  memory: Memory
): Array<Instruction> => {
  const opcodeTable: Array<Instruction> = [];

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
    const addr = (upper << 3) + lower;
    reg.A = memory.readByte(addr);
  });
  opcodeTable[0xea] = new Instruction(0xea, `LD (nn), A`, 16, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 3) + lower;
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
        const n = (upper << 3) + lower;
        reg[label16[x]] = n;
      }
    );
  }
  opcodeTable[0x08] = new Instruction(0x08, `LD (nn), SP`, 20, 3, () => {
    const lower = memory.readByte(reg.incPC());
    const upper = memory.readByte(reg.incPC());
    const addr = (upper << 3) + lower;
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

  // TODO: LD HL, SP+i8 is missing!

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

  return opcodeTable;
};

class CPU {
  reg: Registers;
  memory: Memory;
  clocksToComplete: number;
  funcToExecute: () => void;
  opcodeTable: Array<Instruction>;

  constructor(memory: Memory) {
    this.reg = new Registers();
    this.memory = memory;
    this.clocksToComplete = 0;
    this.funcToExecute = () => {};
    this.opcodeTable = createOpcodeTable(this.reg, this.memory);
  }

  fetch() {
    const opcode = this.memory.readByte(this.reg.incPC());
    const inst = this.opcodeTable[opcode];
    this.clocksToComplete = inst.clocks;
    this.funcToExecute = inst.handler;
  }

  tick() {
    this.clocksToComplete--;
    if (this.clocksToComplete <= 0) {
      this.funcToExecute();
      this.fetch();
    }
  }
}

export default CPU;
