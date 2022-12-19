import "./App.css";
import Emulator from "./Emulator";

const handleRun = (emu: Emulator) => {
  const elem = document.getElementById("rom") as HTMLInputElement;
  if (elem.files === null || elem.files.length === 0) {
    alert("Please select a rom file");
    return;
  }
  const file = elem.files[0];
  file.arrayBuffer().then((buffer: ArrayBuffer) => {
    const rom = new Uint8Array(buffer);
    let addr = 0x0000;
    for (const byte of rom) {
      emu.memory.writeByte(addr++, byte);
    }
    emu.run();
  });
};

const App = () => {
  const emu = new Emulator();

  return (
    <div className="App">
      <h1>Gameboy Emulator</h1>
      <form>
        <input id="rom" type="file" />
        <button type="button" onClick={() => handleRun(emu)}>
          Run
        </button>
      </form>
      <canvas id="screen" width={160} height={144}></canvas>
    </div>
  );
};

export default App;
