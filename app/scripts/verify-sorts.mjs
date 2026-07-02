// Verifies the README claims: every generator sorts the seeded array, and
// replaying the yielded steps through applyStep reproduces each snapshot.
// Run with: npm run verify
import { makeArray, applyStep, SORT_GENERATORS } from "../src/sortSteps.js";

const base = makeArray(1337, 30, 5, 95);
const expected = [...base].sort((a, b) => a - b);
let failures = 0;

for (const [name, gen] of Object.entries(SORT_GENERATORS)) {
  const replay = [...base];
  let last = base;
  let steps = 0, compares = 0, writes = 0;
  for (const step of gen(base)) {
    applyStep(replay, step);
    last = step.snapshot;
    steps++;
    if (step.type === "compare") compares++; else writes++;
    if (JSON.stringify(replay) !== JSON.stringify(step.snapshot)) {
      console.error(`FAIL ${name}: replay diverged from snapshot at step ${steps}`);
      failures++;
      break;
    }
  }
  const sorted = JSON.stringify(last) === JSON.stringify(expected);
  if (!sorted) {
    console.error(`FAIL ${name}: final snapshot not sorted`);
    failures++;
  }
  console.log(`${sorted ? "OK  " : "FAIL"} ${name.padEnd(15)} steps=${String(steps).padStart(3)} compares=${compares} writes=${writes}`);
}

if (JSON.stringify(makeArray(1337, 30, 5, 95)) !== JSON.stringify(base)) {
  console.error("FAIL: makeArray not deterministic for same seed");
  failures++;
}

console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
