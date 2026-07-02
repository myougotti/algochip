// Pure sorting-step machinery for the race visualizer. No React in here:
// everything is a plain function or generator, so it can be replayed and
// verified outside the UI.

// Mulberry32: small deterministic PRNG. Same seed = same sequence.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeArray(seed, n, lo, hi) {
  const rng = mulberry32(seed);
  const out = new Array(n);
  const span = hi - lo + 1;
  for (let i = 0; i < n; i++) {
    out[i] = lo + Math.floor(rng() * span);
  }
  return out;
}

// ---------- Step generators ----------
// Each generator takes an input array (treats it as a copy: never mutates the
// caller's array) and yields step objects shaped like:
//   { type: "compare" | "swap", i: number, j: number, snapshot: number[] }

function* bubbleSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      yield { type: "compare", i: j, j: j + 1, snapshot: arr.slice() };
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        yield { type: "swap", i: j, j: j + 1, snapshot: arr.slice() };
        swapped = true;
      }
    }
    if (!swapped) break; // already sorted
  }
}

function* insertionSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  for (let i = 1; i < n; i++) {
    let j = i;
    while (j > 0) {
      yield { type: "compare", i: j - 1, j: j, snapshot: arr.slice() };
      if (arr[j - 1] > arr[j]) {
        const tmp = arr[j];
        arr[j] = arr[j - 1];
        arr[j - 1] = tmp;
        yield { type: "swap", i: j - 1, j: j, snapshot: arr.slice() };
        j--;
      } else {
        break;
      }
    }
  }
}

function* selectionSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", i: minIdx, j: j, snapshot: arr.slice() };
      if (arr[j] < arr[minIdx]) minIdx = j;
    }
    if (minIdx !== i) {
      const tmp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = tmp;
      yield { type: "swap", i: i, j: minIdx, snapshot: arr.slice() };
    }
  }
}

// Quick sort with Lomuto partition. yield* delegates from a recursive helper
// so the generator reads close to a textbook quicksort.
function* quickSortSteps(input) {
  const arr = [...input];
  yield* qsHelper(arr, 0, arr.length - 1);
}
function* qsHelper(arr, lo, hi) {
  if (lo >= hi) return;
  const pivot = arr[hi];
  let p = lo;
  for (let k = lo; k < hi; k++) {
    yield { type: "compare", i: k, j: hi, snapshot: arr.slice() };
    if (arr[k] < pivot) {
      if (k !== p) {
        const tmp = arr[p];
        arr[p] = arr[k];
        arr[k] = tmp;
        yield { type: "swap", i: p, j: k, snapshot: arr.slice() };
      }
      p++;
    }
  }
  if (p !== hi) {
    const tmp = arr[p];
    arr[p] = arr[hi];
    arr[hi] = tmp;
    yield { type: "swap", i: p, j: hi, snapshot: arr.slice() };
  }
  yield* qsHelper(arr, lo, p - 1);
  yield* qsHelper(arr, p + 1, hi);
}

// Merge sort. Writes from temp buffers back into the array don't fit the
// pairwise swap model, so this generator yields a third step type: "set".
// Step shape for set: { type: "set", i, value, snapshot }.
function* mergeSortSteps(input) {
  const arr = [...input];
  yield* msHelper(arr, 0, arr.length - 1);
}
function* msHelper(arr, lo, hi) {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  yield* msHelper(arr, lo, mid);
  yield* msHelper(arr, mid + 1, hi);
  yield* msMerge(arr, lo, mid, hi);
}
function* msMerge(arr, lo, mid, hi) {
  const left = arr.slice(lo, mid + 1);
  const right = arr.slice(mid + 1, hi + 1);
  let i = 0, j = 0, k = lo;
  while (i < left.length && j < right.length) {
    yield { type: "compare", i: lo + i, j: mid + 1 + j, snapshot: arr.slice() };
    if (left[i] <= right[j]) {
      arr[k] = left[i];
      yield { type: "set", i: k, value: left[i], snapshot: arr.slice() };
      i++;
    } else {
      arr[k] = right[j];
      yield { type: "set", i: k, value: right[j], snapshot: arr.slice() };
      j++;
    }
    k++;
  }
  while (i < left.length) {
    arr[k] = left[i];
    yield { type: "set", i: k, value: left[i], snapshot: arr.slice() };
    i++; k++;
  }
  while (j < right.length) {
    arr[k] = right[j];
    yield { type: "set", i: k, value: right[j], snapshot: arr.slice() };
    j++; k++;
  }
}

// Heap sort. Build a max-heap, then repeatedly swap root with end and sift
// down the shrinking heap. Naturally swap-based.
function* heapSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  // Heapify: sift down from the last non-leaf node up to the root.
  for (let i = (n >> 1) - 1; i >= 0; i--) {
    yield* siftDown(arr, i, n);
  }
  // Extract max: swap root with last unsorted, shrink heap, sift down.
  for (let end = n - 1; end > 0; end--) {
    const tmp = arr[0];
    arr[0] = arr[end];
    arr[end] = tmp;
    yield { type: "swap", i: 0, j: end, snapshot: arr.slice() };
    yield* siftDown(arr, 0, end);
  }
}
function* siftDown(arr, root, end) {
  let i = root;
  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let largest = i;
    if (left < end) {
      yield { type: "compare", i: largest, j: left, snapshot: arr.slice() };
      if (arr[left] > arr[largest]) largest = left;
    }
    if (right < end) {
      yield { type: "compare", i: largest, j: right, snapshot: arr.slice() };
      if (arr[right] > arr[largest]) largest = right;
    }
    if (largest === i) break;
    const tmp = arr[i];
    arr[i] = arr[largest];
    arr[largest] = tmp;
    yield { type: "swap", i: i, j: largest, snapshot: arr.slice() };
    i = largest;
  }
}

// Counting sort. Non-comparison: count occurrences, then write back in order.
// Uses the "set" step type for the writeback.
function* countingSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  if (n === 0) return;
  let max = arr[0], min = arr[0];
  for (let i = 1; i < n; i++) {
    if (arr[i] > max) max = arr[i];
    if (arr[i] < min) min = arr[i];
  }
  const range = max - min + 1;
  const count = new Array(range).fill(0);
  // Tally pass. We yield a "compare" per element so the visualization shows
  // the counting phase progressing, even though no swaps happen yet.
  for (let i = 0; i < n; i++) {
    count[arr[i] - min]++;
    yield { type: "compare", i: i, j: i, snapshot: arr.slice() };
  }
  // Writeback: rebuild arr in sorted order.
  let idx = 0;
  for (let v = 0; v < range; v++) {
    while (count[v] > 0) {
      arr[idx] = v + min;
      yield { type: "set", i: idx, value: v + min, snapshot: arr.slice() };
      idx++;
      count[v]--;
    }
  }
}

// Radix sort (LSD, base 10). Stable counting sort by each digit position.
function* radixSortSteps(input) {
  const arr = [...input];
  const n = arr.length;
  if (n === 0) return;
  let max = arr[0];
  for (let i = 1; i < n; i++) if (arr[i] > max) max = arr[i];
  for (let exp = 1; exp <= max; exp *= 10) {
    yield* countingSortByDigit(arr, exp);
  }
}
function* countingSortByDigit(arr, exp) {
  const n = arr.length;
  const output = new Array(n);
  const count = new Array(10).fill(0);
  for (let i = 0; i < n; i++) {
    const digit = Math.floor(arr[i] / exp) % 10;
    count[digit]++;
    yield { type: "compare", i: i, j: i, snapshot: arr.slice() };
  }
  for (let i = 1; i < 10; i++) count[i] += count[i - 1];
  // Build stable output in reverse for stability.
  for (let i = n - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i];
    count[digit]--;
  }
  // Copy output back into arr, yielding a "set" per write.
  for (let i = 0; i < n; i++) {
    arr[i] = output[i];
    yield { type: "set", i: i, value: output[i], snapshot: arr.slice() };
  }
}

// Apply a single yielded step to an array in place. "compare" is a no-op
// since it does not change order. "set" overwrites a single position
// (used by merge, counting, and radix sorts which write from temp buffers).
// Returned for chainability. Not used by the UI, which paints snapshots
// directly; exported so step sequences can be replayed and verified.
export function applyStep(arr, step) {
  if (step.type === "swap") {
    const tmp = arr[step.i];
    arr[step.i] = arr[step.j];
    arr[step.j] = tmp;
  } else if (step.type === "set") {
    arr[step.i] = step.value;
  }
  return arr;
}

export const SORT_GENERATORS = {
  "Bubble Sort": bubbleSortSteps,
  "Insertion Sort": insertionSortSteps,
  "Selection Sort": selectionSortSteps,
  "Merge Sort": mergeSortSteps,
  "Quick Sort": quickSortSteps,
  "Heap Sort": heapSortSteps,
  "Counting Sort": countingSortSteps,
  "Radix Sort": radixSortSteps,
};
