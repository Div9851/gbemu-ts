import CPU from "./CPU";
import Memory from "./Memory";

const clockFreq = 4.194304e6;

class Emulator {
  cpu: CPU;
  memory: Memory;
  timer: NodeJS.Timer | null;

  constructor() {
    this.memory = new Memory();
    this.cpu = new CPU(this.memory);
    this.timer = null;
  }

  run() {
    alert("emulation started");
    this.timer = setInterval(() => this.tick(), (1 / clockFreq) * 1000);
  }

  tick() {
    console.log("tick!");
  }
}

export default Emulator;
