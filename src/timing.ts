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

import { CubeMoveEvent } from "./state";

export const now: () => number =
    typeof window != 'undefined' && typeof window.performance?.now == 'function' ?
        () => Math.floor(window.performance.now()) :
        typeof process != 'undefined' && typeof process.hrtime?.bigint == 'function' ?
            () => Number(process.hrtime.bigint() / 1_000_000n) :
            () => Date.now();

function interpolateTimestampValues(
    values: Array<number | null | undefined>
): Array<number | null> {
    const n = values.length;
    if (n === 0) {
        return [];
    }

    const processedValues = values.map(v => (v === undefined ? null : v));

    const presentIndices: number[] = [];
    for (let i = 0; i < n; i++) {
        if (processedValues[i] != null) {
            presentIndices.push(i);
        }
    }

    if (presentIndices.length === 0) {
        return processedValues.slice();
    }

    const interpolated_values: Array<number | null> = processedValues.slice();

    if (presentIndices.length === 1) {
        const singleValue = processedValues[presentIndices[0]]!;
        for (let i = 0; i < n; i++) {
            if (interpolated_values[i] === null) {
                interpolated_values[i] = singleValue;
            }
        }
        return interpolated_values;
    }

    const firstPresentIdx = presentIndices[0];
    const firstPresentVal = processedValues[firstPresentIdx]!;
    for (let i = 0; i < firstPresentIdx; i++) {
        if (interpolated_values[i] === null) {
            interpolated_values[i] = firstPresentVal;
        }
    }

    const lastPresentIdx = presentIndices[presentIndices.length - 1];
    const lastPresentVal = processedValues[lastPresentIdx]!;
    for (let i = lastPresentIdx + 1; i < n; i++) {
        if (interpolated_values[i] === null) {
            interpolated_values[i] = lastPresentVal;
        }
    }

    for (let k = 0; k < presentIndices.length - 1; k++) {
        const prevIdx = presentIndices[k];
        const nextIdx = presentIndices[k + 1];
        const prevVal = processedValues[prevIdx]!;
        const nextVal = processedValues[nextIdx]!;

        if (nextIdx - prevIdx > 1) {
            for (let i = prevIdx + 1; i < nextIdx; i++) {
                if (interpolated_values[i] === null) {
                    const t = (i - prevIdx) / (nextIdx - prevIdx);
                    interpolated_values[i] = Math.round(prevVal + t * (nextVal - prevVal));
                }
            }
        }
    }
    return interpolated_values;
}

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
  if (cubeMoves.length === 0) {
    return [];
  }

  const interpolatedCubeTs = interpolateTimestampValues(cubeMoves.map(m => m.cubeTimestamp));
  const interpolatedLocalTs = interpolateTimestampValues(cubeMoves.map(m => m.localTimestamp));

  var [slope, intercept] = linregress(interpolatedCubeTs, interpolatedLocalTs);

  let firstReferenceCubeTs = interpolatedCubeTs.find(ts => ts !== null) ?? 0;


  var first = Math.round(slope * firstReferenceCubeTs + intercept);
  
  var res: Array<{
    move: CubeMoveEvent['move']
    cubeTimestamp: number
    localTimestamp: number
  }> = [];

  for (let i = 0; i < cubeMoves.length; i++) {
    const moveData = cubeMoves[i];
    const currentLocalTs = interpolatedLocalTs[i];
    const currentCubeTs = interpolatedCubeTs[i];

    const transformedCubeTimestamp = currentCubeTs ? Math.round(slope * currentCubeTs + intercept) - first : 0;

    res.push({
      move: moveData.move,
      localTimestamp: currentLocalTs ?? 0, // Ensure number type, default to 0 if null
      cubeTimestamp: transformedCubeTimestamp,
    });
  }
  return res;
}