"use client";

import { useEffect, useState } from "react";
import { ThemePresets, selfCheckThemePresets } from "@/components/settings/ThemePresets";
import { useEditorSession } from "@/lib/editor-session";
import { storage } from "@/lib/storage";

// Runnable check for components/settings/ThemePresets. next/font makes the
// module browser-shaped, so the asserts run here rather than under node.
// The panel below is wired to the real session hook, so picking a row or
// uploading a .ttf goes through the same compile request the editor sends —
// the status line is the round-trip.
export default function ThemePresetsCheckPage() {
  const [check, setCheck] = useState("running…");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCheck(selfCheckThemePresets());
    } catch (e) {
      setCheck(`FAIL — ${(e as Error).message}`);
    }
    storage
      .create({ title: "theme-presets check", markdown: SAMPLE })
      .then((p) => setProjectId(p.id))
      .catch((e: Error) => setCheck(`FAIL — ${e.message}`));
  }, []);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 p-8 sm:grid-cols-[minmax(0,24rem)_1fr]">
      <div className="min-w-0">{projectId && <Panel projectId={projectId} />}</div>
      <pre id="theme-presets-check" className="font-mono text-sm whitespace-pre-wrap">
        {check}
      </pre>
    </div>
  );
}

function Panel({ projectId }: { projectId: string }) {
  const session = useEditorSession(projectId);
  const c = session.compile;

  return (
    <>
      <ThemePresets
        template={session.template}
        bodyFont={session.bodyFont}
        onBodyFontChange={session.setBodyFont}
        fonts={session.fonts}
        onFontUpload={session.addFont}
      />
      <pre id="theme-presets-compile" className="mt-6 font-mono text-2xs whitespace-pre-wrap text-muted">
        {`template: ${session.template}
bodyFont: ${session.bodyFont ?? "(bawaan template)"}
fonts:    ${session.fonts.map((f) => f.name).join(", ") || "(kosong)"}
compile:  ${c.kind}${c.kind === "failed" ? ` — ${c.error.message}` : ""}${c.kind === "ready" ? ` — ${c.url}` : ""}`}
      </pre>
    </>
  );
}

const SAMPLE = `# Bab Satu

Hujan turun pelan di jendela, dan ia membaca sampai halaman 128.
`;
