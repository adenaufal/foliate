import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/EditorShell";
import { COPY } from "@/lib/brand";

// Placeholder only: the project title is in IndexedDB, unreachable from the
// server. EditorShell replaces document.title once the project loads.
export const metadata: Metadata = { title: COPY.untitled };

// Next 15: `params` is a Promise.
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorShell projectId={id} />;
}
