import CPU from "./CPU";
import PPU from "./PPU";
import Memory from "./Memory";

const clockFreq = 4.194304e6;

class Emulator {
  cpu: CPU;
  ppu: PPU;
  memory: Memory;
  clock: NodeJS.Timer | null;

  constructor() {
    this.memory = new Memory();
    this.cpu = new CPU(this.memory);
    this.ppu = new PPU(this.memory);
    this.clock = null;
  }

  run() {
    this.cpu.fetch();
    console.log((1 / clockFreq) * 1000);
    this.clock = setInterval(() => this.tick(), (1 / clockFreq) * 1000);
  }

  tick() {
    this.cpu.tick();
  }
}

export default Emulator;
