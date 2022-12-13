import React from "react";
import "./App.css";

const submitHandler = () => {
  draw();
};

const draw = () => {
  const canvas = document.getElementById("screen") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");
  if (ctx != null) {
    const image = ctx.createImageData(canvas.width, canvas.height);
    const n = canvas.width * canvas.height;
    for (let i = 0; i < n; i++) {
      image.data[i * 4 + 0] = Math.random() * 255;
      image.data[i * 4 + 1] = Math.random() * 255;
      image.data[i * 4 + 2] = Math.random() * 255;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
};

function App() {
  return (
    <div className="App">
      <h1>Gameboy Emulator</h1>
      <form>
        <input id="rom" type="file" />
        <button type="button" onClick={() => submitHandler()}>
          Run
        </button>
      </form>
      <canvas id="screen" width={160} height={144}></canvas>
    </div>
  );
}

export default App;
