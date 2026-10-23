"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => <div className="loading">Loading map…</div>,
});

export default function Page() {
  return <Editor />;
}
