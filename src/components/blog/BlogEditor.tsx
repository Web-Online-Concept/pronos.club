"use client";

import { useRef, useMemo, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "@/styles/blog-content.css";

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function BlogEditor({ content, onChange }: BlogEditorProps) {
  const quillRef = useRef<ReactQuill>(null);

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
      <div className="blog-quill-wrapper">
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
        /* Toolbar */
        .blog-quill-wrapper .ql-toolbar.ql-snow {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px 12px 0 0;
          position: sticky;
          top: 52px;
          z-index: 40;
        }

        /* Container with scroll */
        .blog-quill-wrapper .ql-container.ql-snow {
          border: 1px solid rgba(255,255,255,0.08);
          border-top: none;
          border-radius: 0 0 12px 12px;
          max-height: 600px;
          overflow-y: auto;
        }

        /* Editor area — white background, inherits blog-content styles */
        .blog-quill-wrapper .ql-editor {
          background: #ffffff;
          padding: 2rem;
          min-height: 400px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #374151;
          font-size: 1rem;
          line-height: 1.7;
        }
        .blog-quill-wrapper .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }

        /* Toolbar icon colors */
        .blog-quill-wrapper .ql-toolbar .ql-stroke { stroke: rgba(255,255,255,0.6); }
        .blog-quill-wrapper .ql-toolbar .ql-fill { fill: rgba(255,255,255,0.6); }
        .blog-quill-wrapper .ql-toolbar .ql-picker-label { color: rgba(255,255,255,0.6); }
        .blog-quill-wrapper .ql-toolbar button:hover .ql-stroke,
        .blog-quill-wrapper .ql-toolbar .ql-picker-label:hover .ql-stroke { stroke: #10b981; }
        .blog-quill-wrapper .ql-toolbar button:hover .ql-fill,
        .blog-quill-wrapper .ql-toolbar .ql-picker-label:hover .ql-fill { fill: #10b981; }
        .blog-quill-wrapper .ql-toolbar button.ql-active .ql-stroke { stroke: #10b981; }
        .blog-quill-wrapper .ql-toolbar button.ql-active .ql-fill { fill: #10b981; }
        .blog-quill-wrapper .ql-toolbar .ql-picker-label:hover,
        .blog-quill-wrapper .ql-toolbar .ql-picker-label.ql-active { color: #10b981; }

        /* Dropdowns */
        .blog-quill-wrapper .ql-toolbar .ql-picker-options {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 4px;
        }
        .blog-quill-wrapper .ql-toolbar .ql-picker-item { color: rgba(255,255,255,0.7); }
        .blog-quill-wrapper .ql-toolbar .ql-picker-item:hover { color: #10b981; }

        /* Tooltip */
        .blog-quill-wrapper .ql-tooltip {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .blog-quill-wrapper .ql-tooltip input[type=text] {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          border-radius: 4px;
        }
        .blog-quill-wrapper .ql-tooltip a { color: #10b981; }
      `}} />
    </>
  );
}