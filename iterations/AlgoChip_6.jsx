import React, { useState, useMemo, useRef, useEffect } from "react";

// Mulberry32: small deterministic PRNG. Same seed = same sequence.
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeArray(seed, n, lo, hi) {
  const rng = mulberry32(seed);
  const out = new Array(n);
  const span = hi - lo + 1;
  for (let i = 0; i < n; i++) {
    out[i] = lo + Math.floor(rng() * span);
  }
  return out;
}

// Render an array as bars on a canvas with a shared baseline (canvas bottom).
// Values are normalized against `maxVal` so both canvases line up visually.
function drawBars(canvas, arr, maxVal, color) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color;
  const barW = W / arr.length;
  for (let i = 0; i < arr.length; i++) {
    const h = (arr[i] / maxVal) * H;
    ctx.fillRect(i * barW + 0.5, H - h, barW - 1, h);
  }
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
// Returned for chainability.
function applyStep(arr, step) {
  if (step.type === "swap") {
    const tmp = arr[step.i];
    arr[step.i] = arr[step.j];
    arr[step.j] = tmp;
  } else if (step.type === "set") {
    arr[step.i] = step.value;
  }
  return arr;
}

const SORT_GENERATORS = {
  "Bubble Sort": bubbleSortSteps,
  "Insertion Sort": insertionSortSteps,
  "Selection Sort": selectionSortSteps,
  "Merge Sort": mergeSortSteps,
  "Quick Sort": quickSortSteps,
  "Heap Sort": heapSortSteps,
  "Counting Sort": countingSortSteps,
  "Radix Sort": radixSortSteps,
};

export default function AlgoChip() {
  const [darkMode, setDarkMode] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [leftAlgo, setLeftAlgo] = useState("");
  const [rightAlgo, setRightAlgo] = useState("");

  const columns = [
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "best", label: "Best" },
    { key: "average", label: "Average" },
    { key: "worst", label: "Worst" },
    { key: "space", label: "Space" },
    { key: "notes", label: "Notes" },
  ];

  const ALGORITHMS = [
    // Sort
    { name: "Bubble Sort", category: "Sort", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", notes: "Stable, in-place; mostly a teaching tool." },
    { name: "Insertion Sort", category: "Sort", best: "O(n)", average: "O(n²)", worst: "O(n²)", space: "O(1)", notes: "Stable, in-place; fast on small or nearly sorted arrays." },
    { name: "Selection Sort", category: "Sort", best: "O(n²)", average: "O(n²)", worst: "O(n²)", space: "O(1)", notes: "Not stable; minimizes writes; otherwise weak." },
    { name: "Merge Sort", category: "Sort", best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(n)", notes: "Stable; predictable; good for linked lists and external sort." },
    { name: "Quick Sort", category: "Sort", best: "O(n log n)", average: "O(n log n)", worst: "O(n²)", space: "O(log n)", notes: "Not stable; cache friendly; pivot choice matters." },
    { name: "Heap Sort", category: "Sort", best: "O(n log n)", average: "O(n log n)", worst: "O(n log n)", space: "O(1)", notes: "Not stable, in-place; worst case guaranteed." },
    { name: "Counting Sort", category: "Sort", best: "O(n+k)", average: "O(n+k)", worst: "O(n+k)", space: "O(n+k)", notes: "Stable, non-comparison; needs bounded integer keys, k = key range." },
    { name: "Radix Sort", category: "Sort", best: "O(nk)", average: "O(nk)", worst: "O(nk)", space: "O(n+k)", notes: "Stable, non-comparison; k = number of digits." },

    // Search
    { name: "Linear Search", category: "Search", best: "O(1)", average: "O(n)", worst: "O(n)", space: "O(1)", notes: "Works on any sequence; no preprocessing." },
    { name: "Binary Search", category: "Search", best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)", notes: "Requires sorted input; halves the range each step." },

    // Graph
    { name: "BFS", category: "Graph", best: "O(V+E)", average: "O(V+E)", worst: "O(V+E)", space: "O(V)", notes: "Shortest path on unweighted graphs; uses a queue." },
    { name: "DFS", category: "Graph", best: "O(V+E)", average: "O(V+E)", worst: "O(V+E)", space: "O(V)", notes: "Topological sort, cycle detection; recursion or stack." },
    { name: "Dijkstra", category: "Graph", best: "O((V+E) log V)", average: "O((V+E) log V)", worst: "O((V+E) log V)", space: "O(V)", notes: "Single source shortest path; non-negative weights only." },
    { name: "Bellman-Ford", category: "Graph", best: "O(VE)", average: "O(VE)", worst: "O(VE)", space: "O(V)", notes: "Handles negative edges; detects negative cycles." },
    { name: "A*", category: "Graph", best: "O(E)", average: "O(E log V)", worst: "O(b^d)", space: "O(V)", notes: "Heuristic guided; admissible heuristic gives optimal path." },

    // Tree
    { name: "BST Insert", category: "Tree", best: "O(log n)", average: "O(log n)", worst: "O(n)", space: "O(1)", notes: "Worst case is a skewed tree (essentially a linked list)." },
    { name: "AVL Insert", category: "Tree", best: "O(log n)", average: "O(log n)", worst: "O(log n)", space: "O(1)", notes: "Self-balancing; rotations keep height O(log n)." },

    // Hash
    { name: "Hash Get", category: "Hash", best: "O(1)", average: "O(1)", worst: "O(n)", space: "O(1)", notes: "Worst case on heavy collisions; depends on hash quality." },
    { name: "Hash Set", category: "Hash", best: "O(1)", average: "O(1)", worst: "O(n)", space: "O(1)", notes: "Amortized O(1); resize is occasional O(n)." },
    { name: "Hash Delete", category: "Hash", best: "O(1)", average: "O(1)", worst: "O(n)", space: "O(1)", notes: "Open addressing needs tombstones to preserve probes." },

    // Heap
    { name: "Heap Push", category: "Heap", best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)", notes: "Append, then sift up; binary heap on array." },
    { name: "Heap Pop", category: "Heap", best: "O(log n)", average: "O(log n)", worst: "O(log n)", space: "O(1)", notes: "Swap root with last, then sift down." },

    // String
    { name: "KMP", category: "String", best: "O(n)", average: "O(n+m)", worst: "O(n+m)", space: "O(m)", notes: "Failure function preprocesses pattern; no text backtracking." },
    { name: "Rabin-Karp", category: "String", best: "O(n+m)", average: "O(n+m)", worst: "O(nm)", space: "O(1)", notes: "Rolling hash; great for multi-pattern search." },

    // DP
    { name: "LCS DP", category: "DP", best: "O(nm)", average: "O(nm)", worst: "O(nm)", space: "O(nm)", notes: "2D table; space reducible to O(min(n,m))." },
    { name: "Knapsack 0/1", category: "DP", best: "O(nW)", average: "O(nW)", worst: "O(nW)", space: "O(nW)", notes: "Pseudo-polynomial in capacity W; bottom-up DP." },
  ];

  // theme helper: t(lightClasses, darkClasses)
  const t = (light, dark) => (darkMode ? dark : light);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) {
      return (
        <span
          className="ml-1.5 inline-flex flex-col text-[7px] leading-[7px] opacity-40"
          aria-hidden="true"
        >
          <span>▲</span>
          <span>▼</span>
        </span>
      );
    }
    return (
      <span className="ml-1.5 text-xs" aria-hidden="true">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const filteredRows = ALGORITHMS.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q)
    );
  });

  const sortedRows = sortKey
    ? [...filteredRows].sort((a, b) => {
        const av = String(a[sortKey]).toLowerCase();
        const bv = String(b[sortKey]).toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      })
    : filteredRows;

  const sortAlgorithms = ALGORITHMS.filter((a) => a.category === "Sort");

  // Race state
  const [seed, setSeed] = useState(1337);
  const ARR_LEN = 30;
  const ARR_LO = 5;
  const ARR_HI = 95;
  const baseArray = useMemo(
    () => makeArray(seed, ARR_LEN, ARR_LO, ARR_HI),
    [seed]
  );

  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);

  // Latest array displayed on each canvas. Lives in refs so the animation
  // loop can update them at 30 fps without forcing a React re-render.
  const leftSnapshotRef = useRef(baseArray);
  const rightSnapshotRef = useRef(baseArray);

  // Imperative animation handles
  const rafRef = useRef(null);

  // Step counters and per-side status (idle | running | done) drive the
  // labels under each canvas, so they need to be React state.
  const [leftSteps, setLeftSteps] = useState(0);
  const [rightSteps, setRightSteps] = useState(0);
  const [leftStatus, setLeftStatus] = useState("idle");
  const [rightStatus, setRightStatus] = useState("idle");

  // Mirror darkMode into a ref so the animation loop reads the current value
  // without rebuilding its closure each theme toggle.
  const darkModeRef = useRef(darkMode);
  useEffect(() => {
    darkModeRef.current = darkMode;
  }, [darkMode]);

  const getColor = () => (darkModeRef.current ? "#d4d4d8" : "#3f3f46");

  // Reset snapshots, counters, and statuses when the seeded array changes
  // (mount and Shuffle). Declared BEFORE the paint effect so refs are fresh
  // by the time the paint effect runs on the same render.
  useEffect(() => {
    leftSnapshotRef.current = baseArray.slice();
    rightSnapshotRef.current = baseArray.slice();
    setLeftSteps(0);
    setRightSteps(0);
    setLeftStatus("idle");
    setRightStatus("idle");
  }, [baseArray]);

  // Paint canvases. Reads from snapshot refs so a finished race's final state
  // survives a theme toggle.
  useEffect(() => {
    drawBars(leftCanvasRef.current, leftSnapshotRef.current, 100, getColor());
    drawBars(rightCanvasRef.current, rightSnapshotRef.current, 100, getColor());
  }, [baseArray, darkMode]);

  // Cancel any in-flight animation on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isRunning = leftStatus === "running" || rightStatus === "running";
  const canRun = leftAlgo !== "" && rightAlgo !== "" && !isRunning;

  const startRace = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const leftFn = SORT_GENERATORS[leftAlgo];
    const rightFn = SORT_GENERATORS[rightAlgo];
    if (!leftFn || !rightFn) {
      // Should not happen because the dropdowns are populated from the same
      // source, but fail loudly if it does so the symptom is obvious.
      console.error(
        "Missing generator for selection",
        { leftAlgo, rightAlgo, available: Object.keys(SORT_GENERATORS) }
      );
      return;
    }

    const genLeft = leftFn(baseArray);
    const genRight = rightFn(baseArray);

    // Reset everything to baseline state.
    leftSnapshotRef.current = baseArray.slice();
    rightSnapshotRef.current = baseArray.slice();
    setLeftSteps(0);
    setRightSteps(0);
    setLeftStatus("running");
    setRightStatus("running");
    drawBars(leftCanvasRef.current, leftSnapshotRef.current, 100, getColor());
    drawBars(rightCanvasRef.current, rightSnapshotRef.current, 100, getColor());

    let leftDone = false;
    let rightDone = false;
    let leftCount = 0;
    let rightCount = 0;
    let lastFrame = 0;
    const FRAME_INTERVAL = 1000 / 30; // target ~30 fps

    const tick = (now) => {
      // Throttle to target frame rate. RAF itself runs at ~60 fps.
      if (now - lastFrame < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;

      if (!leftDone) {
        const r = genLeft.next();
        if (r.done) {
          leftDone = true;
          setLeftStatus("done");
        } else {
          leftSnapshotRef.current = r.value.snapshot;
          leftCount++;
          setLeftSteps(leftCount);
          drawBars(leftCanvasRef.current, leftSnapshotRef.current, 100, getColor());
        }
      }

      if (!rightDone) {
        const r = genRight.next();
        if (r.done) {
          rightDone = true;
          setRightStatus("done");
        } else {
          rightSnapshotRef.current = r.value.snapshot;
          rightCount++;
          setRightSteps(rightCount);
          drawBars(rightCanvasRef.current, rightSnapshotRef.current, 100, getColor());
        }
      }

      if (!leftDone || !rightDone) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const stopRace = () => {
    // Cancel any in-flight rAF unconditionally. Safe to call with null.
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Functional updates read the LIVE status, not a value captured in the
    // closure of whichever render created this handler. Without this, a click
    // that happens between a state update and React's commit can fire with
    // stale "running" values and skip the transition to "stopped".
    setLeftStatus((s) => (s === "running" ? "stopped" : s));
    setRightStatus((s) => (s === "running" ? "stopped" : s));
  };

  const handleShuffle = () => {
    if (isRunning) return; // defensive; the button is also disabled
    // Pick a fresh non-zero seed. Math.random gives unpredictable variety;
    // the array generation itself remains deterministic from that seed.
    setSeed(Math.floor(Math.random() * 0x7fffffff) || 1);
  };

  return (
    <div
      className={`min-h-screen w-full ${t("bg-stone-50", "bg-zinc-950")} ${t(
        "text-zinc-900",
        "text-zinc-100"
      )} transition-colors duration-200`}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-black tracking-tight">AlgoChip</h1>
              <span
                className={`text-xs font-mono uppercase tracking-widest ${t(
                  "text-zinc-500",
                  "text-zinc-400"
                )}`}
              >
                v0.1
              </span>
            </div>
            <p
              className={`text-sm mt-1 ${t(
                "text-zinc-600",
                "text-zinc-400"
              )}`}
            >
              Big-O reference plus sort race
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${t(
              "border-zinc-300 bg-white hover:bg-zinc-100",
              "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
            )}`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? "☀ Light" : "☾ Dark"}
          </button>
        </header>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or category..."
            className={`w-full px-4 py-2.5 rounded-md border text-sm transition-colors focus:outline-none focus:ring-2 ${t(
              "border-zinc-300 bg-white placeholder:text-zinc-400 focus:ring-zinc-900",
              "border-zinc-700 bg-zinc-900 placeholder:text-zinc-500 focus:ring-zinc-300"
            )}`}
          />
        </div>

        {/* Table */}
        <div
          className={`overflow-x-auto rounded-md border ${t(
            "border-zinc-300",
            "border-zinc-700"
          )}`}
        >
          <table className="w-full text-sm">
            <thead className={t("bg-zinc-100", "bg-zinc-900")}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-left font-semibold cursor-pointer select-none transition-colors ${t(
                      "hover:bg-zinc-200",
                      "hover:bg-zinc-800"
                    )}`}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {sortIndicator(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={`px-4 py-12 text-center text-sm ${t(
                      "text-zinc-500",
                      "text-zinc-500"
                    )}`}
                  >
                    No matches
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, i) => (
                  <tr
                    key={`${row.category}-${row.name}`}
                    className={`${
                      i % 2 === 0
                        ? t("bg-white", "bg-zinc-950")
                        : t("bg-stone-50", "bg-zinc-900")
                    } ${t("hover:bg-amber-50", "hover:bg-zinc-800")} transition-colors`}
                  >
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider ${t("text-zinc-600", "text-zinc-400")}`}>
                      {row.category}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                      {row.best}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                      {row.average}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                      {row.worst}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                      {row.space}
                    </td>
                    <td className={`px-4 py-2.5 text-xs ${t("text-zinc-600", "text-zinc-400")}`}>
                      {row.notes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Divider */}
        <hr className={`my-10 ${t("border-zinc-300", "border-zinc-700")}`} />

        {/* Race Panel */}
        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-2xl font-bold tracking-tight">Race</h2>
            <span
              className={`text-xs font-mono uppercase tracking-widest ${t(
                "text-zinc-500",
                "text-zinc-400"
              )}`}
            >
              head to head
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-6">
            <div className="flex-1 min-w-[180px]">
              <label
                className={`block text-xs font-mono uppercase tracking-wider mb-1.5 ${t(
                  "text-zinc-600",
                  "text-zinc-400"
                )}`}
              >
                Left
              </label>
              <select
                value={leftAlgo}
                onChange={(e) => setLeftAlgo(e.target.value)}
                disabled={isRunning}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  isRunning
                    ? t(
                        "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed",
                        "border-zinc-800 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                      )
                    : t(
                        "border-zinc-300 bg-white focus:ring-zinc-900",
                        "border-zinc-700 bg-zinc-900 focus:ring-zinc-300"
                      )
                }`}
              >
                <option value="">Select algorithm...</option>
                {sortAlgorithms.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label
                className={`block text-xs font-mono uppercase tracking-wider mb-1.5 ${t(
                  "text-zinc-600",
                  "text-zinc-400"
                )}`}
              >
                Right
              </label>
              <select
                value={rightAlgo}
                onChange={(e) => setRightAlgo(e.target.value)}
                disabled={isRunning}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${
                  isRunning
                    ? t(
                        "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed",
                        "border-zinc-800 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                      )
                    : t(
                        "border-zinc-300 bg-white focus:ring-zinc-900",
                        "border-zinc-700 bg-zinc-900 focus:ring-zinc-300"
                      )
                }`}
              >
                <option value="">Select algorithm...</option>
                {sortAlgorithms.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!canRun}
              onClick={startRace}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${
                canRun
                  ? t(
                      "bg-zinc-900 text-white hover:bg-zinc-700",
                      "bg-zinc-100 text-zinc-900 hover:bg-white"
                    )
                  : t(
                      "bg-zinc-200 text-zinc-400 cursor-not-allowed",
                      "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    )
              }`}
            >
              {isRunning ? "Running..." : "Run"}
            </button>

            <button
              type="button"
              disabled={!isRunning}
              onClick={stopRace}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors border ${
                isRunning
                  ? t(
                      "border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
                      "border-rose-700 bg-zinc-900 text-rose-400 hover:bg-rose-950"
                    )
                  : t(
                      "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed",
                      "border-zinc-800 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                    )
              }`}
            >
              Stop
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={handleShuffle}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors border ${
                !isRunning
                  ? t(
                      "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100",
                      "border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                    )
                  : t(
                      "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed",
                      "border-zinc-800 bg-zinc-950 text-zinc-600 cursor-not-allowed"
                    )
              }`}
            >
              Shuffle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                side: "left",
                ref: leftCanvasRef,
                algo: leftAlgo,
                steps: leftSteps,
                status: leftStatus,
              },
              {
                side: "right",
                ref: rightCanvasRef,
                algo: rightAlgo,
                steps: rightSteps,
                status: rightStatus,
              },
            ].map(({ side, ref, algo, steps, status }) => (
              <div key={side}>
                <div
                  className={`rounded-md border p-4 flex flex-col items-center ${t(
                    "border-zinc-300 bg-white",
                    "border-zinc-700 bg-zinc-900"
                  )}`}
                >
                  <div
                    className={`w-full mb-3 text-xs font-mono uppercase tracking-widest text-center ${t(
                      "text-zinc-600",
                      "text-zinc-400"
                    )}`}
                  >
                    {algo || `${side} (no selection)`}
                  </div>
                  <canvas
                    ref={ref}
                    width={200}
                    height={120}
                    className={`block ${t("bg-stone-50", "bg-zinc-950")}`}
                    style={{ width: 200, height: 120 }}
                  />
                </div>
                <p
                  className={`mt-2 text-center text-xs font-mono uppercase tracking-wider ${
                    status === "done"
                      ? t("text-emerald-700", "text-emerald-400")
                      : status === "stopped"
                      ? t("text-rose-700", "text-rose-400")
                      : t("text-zinc-600", "text-zinc-400")
                  }`}
                >
                  {status === "done"
                    ? `Done in ${steps} steps`
                    : status === "stopped"
                    ? `Stopped at ${steps} steps`
                    : `Steps: ${steps}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
