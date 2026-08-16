"use client";

import { useEffect, useState } from "react";
import { selfCheckLocal } from "@/lib/storage";

// The runnable check for lib/storage.ts. IndexedDB is browser-only, so it
// cannot run under node — open /dev/storage-check instead.
export default function StorageCheckPage() {
  const [result, setResult] = useState("running…");
  useEffect(() => {
    selfCheckLocal().then(setResult, (e: Error) => setResult(`FAIL — ${e.message}`));
  }, []);
  return (
    <pre id="storage-check" className="p-8 font-mono text-sm">
      {result}
    </pre>
  );
}
