import React from "react";
import "./App.css";
import Emulator from "./Emulator";

const App = () => {
  const emu = new Emulator();

  return (
    <div className="App">
      <h1>Gameboy Emulator</h1>
      <form>
        <input id="rom" type="file" />
        <button type="button" onClick={() => emu.run()}>
          Run
        </button>
      </form>
      <canvas id="screen" width={160} height={144}></canvas>
    </div>
  );
};

export default App;
