// Adapted from https://github.com/afedotov/gan-web-bluetooth
// MIT License
// Copyright (c) Andy Fedotov, https://github.com/afedotov
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { CubeMoveEvent } from "./state";

export const now: () => number =
    typeof window != 'undefined' && typeof window.performance?.now == 'function' ?
        () => Math.floor(window.performance.now()) :
        typeof process != 'undefined' && typeof process.hrtime?.bigint == 'function' ?
            () => Number(process.hrtime.bigint() / 1_000_000n) :
            () => Date.now();

function linregress(X: Array<number | null>, Y: Array<number | null>) {
  var sumX = 0;
  var sumY = 0;
  var sumXY = 0;
  var sumXX = 0;
  var sumYY = 0;
  var n = 0;
  for (var i = 0; i < X.length; i++) {
      var x = X[i];
      var y = Y[i];
      if (x == null || y == null) {
          continue;
      }
      n++;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
      sumYY += y * y;
  }
  var varX = n * sumXX - sumX * sumX;
  var covXY = n * sumXY - sumX * sumY;
  var slope = varX < 1e-3 ? 1 : covXY / varX;
  var intercept = n < 1 ? 0 : sumY / n - slope * sumX / n;
  return [slope, intercept];
}

/**
* Use linear regression to fit timestamps reported by cube hardware with host device timestamps
* @param cubeMoves List representing window of cube moves to operate on
* @returns New copy of move list with fitted cubeTimestamp values
*/
export function cubeTimestampLinearFit(cubeMoves: Array<CubeMoveEvent>): Array<{
  move: CubeMoveEvent['move']
  cubeTimestamp: number
  localTimestamp: number
}> {
  var res: Array<{
    move: CubeMoveEvent['move']
    cubeTimestamp: number
    localTimestamp: number
  }> = [];
  // Calculate and fix timestamp values for missed and recovered cube moves.
  if (cubeMoves.length >= 2) {
      // 1st pass - tail-to-head, align missed move cube timestamps to next move -50ms
      for (let i = cubeMoves.length - 1; i > 0; i--) {
          if (cubeMoves[i].cubeTimestamp != null && cubeMoves[i - 1].cubeTimestamp == null)
              cubeMoves[i - 1].cubeTimestamp = cubeMoves[i].cubeTimestamp! - 50;
      }

      // do the same for local
      for (let i = cubeMoves.length - 1; i > 0; i--) {
        if (cubeMoves[i].localTimestamp != null && cubeMoves[i - 1].localTimestamp == null)
            cubeMoves[i - 1].localTimestamp = cubeMoves[i].localTimestamp! - 50;
    }

      // 2nd pass - head-to-tail, align missed move cube timestamp to prev move +50ms
      for (let i = 0; i < cubeMoves.length - 1; i++) {
          if (cubeMoves[i].cubeTimestamp != null && cubeMoves[i + 1].cubeTimestamp == null)
              cubeMoves[i + 1].cubeTimestamp = cubeMoves[i].cubeTimestamp! + 50;
      }

      // do the same for local
      for (let i = 0; i < cubeMoves.length - 1; i++) {
        if (cubeMoves[i].localTimestamp != null && cubeMoves[i + 1].localTimestamp == null)
            cubeMoves[i + 1].localTimestamp = cubeMoves[i].localTimestamp! + 50;
    }
  }
  // Apply linear regression to the cube timestamps
  if (cubeMoves.length > 0) {
      var [slope, intercept] = linregress(cubeMoves.map(m => m.cubeTimestamp!), cubeMoves.map(m => m.localTimestamp!));
      var first = Math.round(slope * cubeMoves[0].cubeTimestamp! + intercept);
      cubeMoves.forEach(m => {
          res.push({
              move: m.move,
              localTimestamp: m.localTimestamp!,
              cubeTimestamp: Math.round(slope * m.cubeTimestamp! + intercept) - first
          });
      });
  }
  return res;
}