import { connectQYSC } from "qysc-web";
import { TwistyPlayer } from "cubing/twisty";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";

let sync: (() => Promise<void>) | undefined = undefined;
let freshState: (() => Promise<void>) | undefined = undefined;

async function doTheCube() {
  const cube = await connectQYSC();
  sync = cube.sync;
  freshState = cube.freshState;

  // Handle state changes
  cube.events.state.subscribe(async (event) => {
    if (event.type === 'state' || event.type === 'freshState') return;

    const solution = await experimentalSolve3x3x3IgnoringCenters(event.pattern);
    const scramble = solution.invert();
    movesParagraph.textContent = '';
    player.alg = scramble.toString();
  });

  // Handle moves
  cube.events.moves.subscribe((move) => {
    const span = document.createElement('span');
    span.textContent = move + ' ';
    span.style.color = 'black';
    movesParagraph.appendChild(span);
    player.experimentalAddMove(move.move);
  });
}

const app = document.getElementById('app');

// Create paragraph for moves
const movesParagraph = document.createElement('p');
movesParagraph.style.fontFamily = 'monospace';
movesParagraph.style.whiteSpace = 'pre-wrap';
movesParagraph.style.marginBottom = '10px';
app?.appendChild(movesParagraph);

// Create reset button
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Moves';
resetButton.style.marginBottom = '10px';
resetButton.addEventListener('click', () => {
  movesParagraph.textContent = '';
});
app?.appendChild(resetButton);

const player = new TwistyPlayer({});
app?.appendChild(player);

const button = document.createElement('button');
button.textContent = 'Do Functionality';
button.addEventListener('click', doTheCube);
app?.appendChild(button);

const syncButton = document.createElement('button');
syncButton.textContent = 'Sync';
syncButton.addEventListener('click', async () => {
  sync && await sync();
  player.alg = "";
});
app?.appendChild(syncButton);
