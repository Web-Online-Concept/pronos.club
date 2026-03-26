"use client";

import { useState } from "react";

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function BlogEditor({ content, onChange }: BlogEditorProps) {
  const [tab, setTab] = useState<"edit" | "preview" | "split">("split");

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12121a]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        {(["edit", "split", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === t
                ? "bg-emerald-500/30 text-emerald-300"
                : "text-white/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            {t === "edit" ? "✏️ Code HTML" : t === "preview" ? "👁️ Aperçu" : "📐 Les deux"}
          </button>
        ))}
        <div className="mx-2 h-5 w-px bg-white/10" />
        <span className="text-[10px] text-white/20">
          Collez votre HTML depuis l&apos;IA directement
        </span>
      </div>

      {/* Editor area */}
      <div className={`${tab === "split" ? "grid grid-cols-2 divide-x divide-white/[0.06]" : ""}`}>
        {/* Textarea */}
        {(tab === "edit" || tab === "split") && (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={"Collez votre article HTML ici...\n\nExemple :\n<h2>Mon titre</h2>\n<p>Mon paragraphe avec du <strong>gras</strong>.</p>"}
            className="w-full min-h-[500px] resize-y bg-transparent px-4 py-4 font-mono text-sm text-white/80 placeholder:text-white/15 focus:outline-none"
            spellCheck={false}
          />
        )}

        {/* Preview */}
        {(tab === "preview" || tab === "split") && (
          <div className="min-h-[500px] overflow-auto bg-white px-6 py-6">
            {content ? (
              <div
                className={[
                  "prose prose-lg prose-neutral max-w-none",
                  "prose-headings:font-bold prose-headings:text-neutral-900",
                  "prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-2xl",
                  "prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-xl",
                  "prose-p:text-neutral-700 prose-p:leading-relaxed prose-p:mb-5",
                  "prose-a:text-emerald-600",
                  "prose-strong:text-neutral-900",
                  "prose-blockquote:border-l-emerald-500 prose-blockquote:text-neutral-500",
                  "prose-img:rounded-xl prose-img:mx-auto prose-img:my-6",
                  "prose-ul:mb-5 prose-ol:mb-5",
                  "prose-li:mb-1 prose-li:marker:text-emerald-500",
                  "[&_iframe]:rounded-xl [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:my-6",
                  "[&_hr]:my-8 [&_hr]:border-neutral-200",
                ].join(" ")}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <p className="text-sm text-neutral-300 italic">L&apos;aperçu apparaîtra ici...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}