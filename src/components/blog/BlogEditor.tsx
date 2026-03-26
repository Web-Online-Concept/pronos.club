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
          <div
            className="min-h-[500px] overflow-auto bg-white px-6 py-6"
            style={{ color: "#374151" }}
          >
            {content ? (
              <div
                className="blog-preview-styles"
                style={{ color: "#374151" }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <p style={{ color: "#9ca3af", fontStyle: "italic" }}>L&apos;aperçu apparaîtra ici...</p>
            )}
          </div>
        )}
      </div>

      {/* Style for preview content */}
      <style dangerouslySetInnerHTML={{ __html: `
        .blog-preview-styles h2 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-top: 2rem; margin-bottom: 1rem; }
        .blog-preview-styles h3 { font-size: 1.25rem; font-weight: 700; color: #111827; margin-top: 1.5rem; margin-bottom: 0.75rem; }
        .blog-preview-styles p { margin-bottom: 1.25rem; line-height: 1.75; color: #374151; }
        .blog-preview-styles strong { color: #111827; font-weight: 700; }
        .blog-preview-styles a { color: #059669; }
        .blog-preview-styles ul, .blog-preview-styles ol { margin-bottom: 1.25rem; padding-left: 1.5rem; }
        .blog-preview-styles ul { list-style-type: disc; }
        .blog-preview-styles ol { list-style-type: decimal; }
        .blog-preview-styles li { margin-bottom: 0.25rem; color: #374151; }
        .blog-preview-styles blockquote { border-left: 4px solid #10b981; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 1.5rem 0; }
        .blog-preview-styles img { border-radius: 12px; max-width: 100%; margin: 1.5rem auto; display: block; }
        .blog-preview-styles hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
        .blog-preview-styles iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; margin: 1.5rem 0; }
      `}} />
    </div>
  );
}