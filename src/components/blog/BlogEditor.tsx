"use client";

import { useRef, useMemo, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function BlogEditor({ content, onChange }: BlogEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

  // Image upload handler
  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/blog/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (data.url && quillRef.current) {
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection(true);
          editor.insertEmbed(range.index, "image", data.url);
          editor.setSelection(range.index + 1);
        } else {
          alert("Erreur upload : " + (data.error || "URL manquante"));
        }
      } catch (err) {
        alert("Erreur upload : " + String(err));
      }
    };
  }, []);

  // Quill modules config
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [2, 3, 4, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote"],
        ["link", "image", "video"],
        [{ color: [] }],
        ["clean"],
      ],
      handlers: {
        image: imageHandler,
      },
    },
    clipboard: {
      matchVisual: true,
    },
  }), [imageHandler]);

  const formats = [
    "header",
    "bold", "italic", "underline", "strike",
    "align",
    "list",
    "blockquote",
    "link", "image", "video",
    "color",
  ];

  return (
    <>
      <div className="blog-quill-editor">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder="Écrivez ou collez votre article ici..."
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Container */
        .blog-quill-editor .ql-toolbar.ql-snow {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px 12px 0 0;
        }
        .blog-quill-editor .ql-container.ql-snow {
          border: 1px solid rgba(255,255,255,0.08);
          border-top: none;
          border-radius: 0 0 12px 12px;
          min-height: 500px;
        }

        /* Editor area - WHITE background like the public page */
        .blog-quill-editor .ql-editor {
          background: #ffffff;
          color: #374151;
          font-size: 1.125rem;
          line-height: 1.5;
          padding: 2rem;
          min-height: 500px;
        }
        .blog-quill-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }

        /* Toolbar buttons - light on dark */
        .blog-quill-editor .ql-toolbar .ql-stroke {
          stroke: rgba(255,255,255,0.6);
        }
        .blog-quill-editor .ql-toolbar .ql-fill {
          fill: rgba(255,255,255,0.6);
        }
        .blog-quill-editor .ql-toolbar .ql-picker-label {
          color: rgba(255,255,255,0.6);
        }
        .blog-quill-editor .ql-toolbar button:hover .ql-stroke,
        .blog-quill-editor .ql-toolbar .ql-picker-label:hover .ql-stroke {
          stroke: #10b981;
        }
        .blog-quill-editor .ql-toolbar button:hover .ql-fill,
        .blog-quill-editor .ql-toolbar .ql-picker-label:hover .ql-fill {
          fill: #10b981;
        }
        .blog-quill-editor .ql-toolbar button.ql-active .ql-stroke {
          stroke: #10b981;
        }
        .blog-quill-editor .ql-toolbar button.ql-active .ql-fill {
          fill: #10b981;
        }
        .blog-quill-editor .ql-toolbar .ql-picker-label:hover,
        .blog-quill-editor .ql-toolbar .ql-picker-label.ql-active {
          color: #10b981;
        }

        /* Dropdown menus */
        .blog-quill-editor .ql-toolbar .ql-picker-options {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 4px;
        }
        .blog-quill-editor .ql-toolbar .ql-picker-item {
          color: rgba(255,255,255,0.7);
        }
        .blog-quill-editor .ql-toolbar .ql-picker-item:hover {
          color: #10b981;
        }

        /* Content styling inside editor - matches public page */
        .blog-quill-editor .ql-editor h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
        }
        .blog-quill-editor .ql-editor h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .blog-quill-editor .ql-editor h4 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .blog-quill-editor .ql-editor p {
          margin-bottom: 0.15rem;
          line-height: 1.5;
          color: #374151;
        }
        .blog-quill-editor .ql-editor strong { color: #111827; }
        .blog-quill-editor .ql-editor a { color: #059669; }
        .blog-quill-editor .ql-editor blockquote {
          border-left: 4px solid #10b981;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
          margin: 1.5rem 0;
        }
        .blog-quill-editor .ql-editor ul,
        .blog-quill-editor .ql-editor ol {
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
        }
        .blog-quill-editor .ql-editor li {
          margin-bottom: 0.25rem;
          color: #374151;
        }
        .blog-quill-editor .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          margin: 1.5rem auto;
          display: block;
        }
        .blog-quill-editor .ql-editor iframe {
          width: 100%;
          aspect-ratio: 16/9;
          border-radius: 12px;
          margin: 1.5rem 0;
        }
        .blog-quill-editor .ql-editor hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2rem 0;
        }

        /* Tooltip */
        .blog-quill-editor .ql-tooltip {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .blog-quill-editor .ql-tooltip input[type=text] {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          border-radius: 4px;
        }
        .blog-quill-editor .ql-tooltip a.ql-action,
        .blog-quill-editor .ql-tooltip a.ql-remove {
          color: #10b981;
        }
      `}} />
    </>
  );
}