import React, { useState } from "react";

export default function AlgoChip() {
  const [darkMode, setDarkMode] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
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
    if (sortKey !== key) return <span className="text-slate-400 ml-1">·</span>;
    return (
      <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
    );
  };

  const filteredRows = ALGORITHMS.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.category.toLowerCase().includes(q) ||
      row.notes.toLowerCase().includes(q)
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
            placeholder="Search algorithms by name, category, or notes..."
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
                Algorithm A
              </label>
              <select
                value={leftAlgo}
                onChange={(e) => setLeftAlgo(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${t(
                  "border-zinc-300 bg-white focus:ring-zinc-900",
                  "border-zinc-700 bg-zinc-900 focus:ring-zinc-300"
                )}`}
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
                Algorithm B
              </label>
              <select
                value={rightAlgo}
                onChange={(e) => setRightAlgo(e.target.value)}
                className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 ${t(
                  "border-zinc-300 bg-white focus:ring-zinc-900",
                  "border-zinc-700 bg-zinc-900 focus:ring-zinc-300"
                )}`}
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
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-colors ${t(
                "bg-zinc-900 text-white hover:bg-zinc-700",
                "bg-zinc-100 text-zinc-900 hover:bg-white"
              )}`}
            >
              Run
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div
                  className={`relative rounded-md border overflow-hidden ${t(
                    "border-zinc-300 bg-white",
                    "border-zinc-700 bg-zinc-900"
                  )}`}
                >
                  <canvas
                    width={600}
                    height={300}
                    className="block w-full h-64"
                  />
                  <div
                    className={`absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-mono uppercase tracking-widest ${t(
                      "text-zinc-400",
                      "text-zinc-600"
                    )}`}
                  >
                    canvas {i === 0 ? "A" : "B"}
                  </div>
                </div>
                <p
                  className={`mt-2 text-center text-xs font-mono uppercase tracking-wider ${t(
                    "text-zinc-600",
                    "text-zinc-400"
                  )}`}
                >
                  Steps: 0
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
