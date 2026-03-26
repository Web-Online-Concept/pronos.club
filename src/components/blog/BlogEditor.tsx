"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useRef } from "react";

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function BlogEditor({ content, onChange }: BlogEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-emerald-400 underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full mx-auto my-4" },
      }),
      Youtube.configure({
        HTMLAttributes: { class: "rounded-lg overflow-hidden my-4 mx-auto" },
        width: 640,
        height: 360,
      }),
      Placeholder.configure({
        placeholder: "Commencez à écrire votre article...",
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-emerald max-w-none min-h-[400px] px-6 py-4 focus:outline-none " +
          "prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg " +
          "prose-p:text-white/80 prose-p:leading-relaxed " +
          "prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline " +
          "prose-strong:text-white prose-em:text-white/70 " +
          "prose-img:rounded-xl prose-img:mx-auto " +
          "prose-blockquote:border-l-emerald-500 prose-blockquote:text-white/60 " +
          "prose-ul:text-white/80 prose-ol:text-white/80 " +
          "prose-li:marker:text-emerald-500",
      },
    },
  });

  const addImage = useCallback(async (file: File) => {
    if (!editor) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/blog/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }, [editor]);

  const addImageUrl = useCallback(() => {
    if (!editor) return;
    const url = prompt("URL de l'image :");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const addYouTube = useCallback(() => {
    if (!editor) return;
    const url = prompt("URL YouTube :");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = prompt("URL du lien :");
    if (url) {
      editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({
    active,
    onClick,
    children,
    title,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-md px-2 py-1.5 text-xs transition ${
        active
          ? "bg-emerald-500/30 text-emerald-300"
          : "text-white/50 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12121a]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
        {/* Text formatting */}
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <em>I</em>
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné">
          <u>U</u>
        </ToolBtn>
        <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
          <s>S</s>
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Headings */}
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre H2">
          H2
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre H3">
          H3
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Titre H4">
          H4
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Lists */}
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
          • Liste
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
          1. Liste
        </ToolBtn>
        <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
          ❝ Citation
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Alignment */}
        <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Aligner à gauche">
          ≡←
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Centrer">
          ≡↔
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Media */}
        <ToolBtn onClick={addLink} active={editor.isActive("link")} title="Ajouter un lien">
          🔗 Lien
        </ToolBtn>
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Uploader une image">
          📷 Image
        </ToolBtn>
        <ToolBtn onClick={addImageUrl} title="Image depuis URL">
          🌐 Image URL
        </ToolBtn>
        <ToolBtn onClick={addYouTube} title="Vidéo YouTube">
          ▶️ YouTube
        </ToolBtn>

        <div className="mx-1 h-5 w-px bg-white/10" />

        {/* Undo / redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Annuler">
          ↩
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Rétablir">
          ↪
        </ToolBtn>

        {/* Separator line */}
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
          ―
        </ToolBtn>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addImage(f);
          e.target.value = "";
        }}
      />

      {/* Bubble menu (on text selection) */}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1a1a2e] px-2 py-1 shadow-xl">
            <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
              <strong>B</strong>
            </ToolBtn>
            <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <em>I</em>
            </ToolBtn>
            <ToolBtn active={editor.isActive("link")} onClick={addLink}>
              🔗
            </ToolBtn>
          </div>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}