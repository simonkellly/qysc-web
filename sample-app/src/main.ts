import { connectQYSC } from "qysc-web";
import { TwistyPlayer } from "cubing/twisty";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import './index.css';

const app = document.getElementById('app')!;
app.innerHTML = `
  <h1>QYSC Web</h1>
  <h3>
    <a href="https://github.com/simonkellly/qysc-web">GitHub</a>
    <a href="https://www.npmjs.com/package/qysc-web">NPM</a>
  </h3>
  <p id="status">No cube connected</p>
  <div>
    <button id="connect">Connect</button>
    <button id="disconnect">Disconnect</button>
    <button id="reset">Mark Solved</button>
    <button id="clear">Clear Moves</button>
  </div>
  <p id="moves" style="font-family: monospace;">
    Moves will be displayed here
  </p>
  <div id="player" />
`;

let sync: (() => Promise<void>) | undefined = undefined;
let disconnect: (() => Promise<void>) | undefined = undefined;

const movesParagraph = document.getElementById('moves')!;
const status = document.getElementById('status')!;

const player = new TwistyPlayer({});
document.getElementById('player')?.appendChild(player);

document.getElementById('connect')?.addEventListener('click', async () => {
  const cube = await connectQYSC();
  sync = cube.sync;
  disconnect = cube.disconnect;
  
  // Handle state changes
  cube.events.state.subscribe(async (event) => {
    if (event.type === 'state' || event.type === 'freshState') return;

    status!.textContent = `Cube connected: ${cube.name}`;
    const solution = await experimentalSolve3x3x3IgnoringCenters(event.pattern);
    const scramble = solution.invert();
    movesParagraph.textContent = '';
    player.alg = scramble.toString();
  });

  // Handle moves
  cube.events.moves.subscribe((move) => {
    movesParagraph.textContent += move + ' ';
    player.experimentalAddMove(move.move);
  });
});

document.getElementById('disconnect')?.addEventListener('click', async () => {
  if (disconnect) {
    await disconnect();
    status.textContent = 'No cube connected';
    movesParagraph.textContent = '';
    player.alg = "";
  }
});

document.getElementById('reset')?.addEventListener('click', async () => {
  if (sync) {
    await sync();
  }
});

document.getElementById('clear')?.addEventListener('click', () => {
  movesParagraph.textContent = '';
});
