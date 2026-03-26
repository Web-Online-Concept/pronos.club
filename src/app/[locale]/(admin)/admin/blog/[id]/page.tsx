"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";

const BlogEditor = dynamic(() => import("@/components/blog/BlogEditor"), { ssr: false });

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
}

export default function AdminBlogEditorPage() {
  const router = useRouter();
  const { locale, id } = useParams();
  const isNew = id === "new";
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSeo, setShowSeo] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [postId, setPostId] = useState<string | null>(null);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      const generated = title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      setSlug(generated);
    }
  }, [title, slugManual]);

  useEffect(() => {
    fetch("/api/blog/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  // Load existing post
  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const listRes = await fetch(`/api/blog?admin=true&limit=200`);
        const listData = await listRes.json();
        const post = (listData.posts || []).find((p: { id: string }) => p.id === id);
        if (!post) {
          alert("Article introuvable");
          router.push(`/${locale}/admin/blog`);
          return;
        }
        const fullRes = await fetch(`/api/blog?slug=${post.slug}&admin=true`);
        const fullPost = await fullRes.json();

        setTitle(fullPost.title || "");
        setSlug(fullPost.slug || "");
        setSlugManual(true);
        setExcerpt(fullPost.excerpt || "");
        setContent(fullPost.content || "");
        setCoverImage(fullPost.cover_image || "");
        setCategoryId(fullPost.category_id || "");
        setTags((fullPost.tags || []).join(", "));
        setStatus(fullPost.status || "draft");
        setMetaTitle(fullPost.meta_title || "");
        setMetaDescription(fullPost.meta_description || "");
        setPostId(fullPost.id);
      } catch {
        alert("Erreur chargement article");
      }
      setLoading(false);
    })();
  }, [id, isNew, locale, router]);

  // Upload cover image
  const handleCoverUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/blog/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setCoverImage(data.url);
      } else {
        alert("Erreur upload : " + (data.error || "réponse invalide"));
      }
    } catch (err) {
      alert("Erreur upload image : " + String(err));
    }
  }, []);

  const handleSave = async (publishNow?: boolean) => {
    if (!title.trim()) { alert("Le titre est obligatoire"); return; }
    if (!slug.trim()) { alert("Le slug est obligatoire"); return; }

    setSaving(true);
    const finalStatus = publishNow ? "published" : status;

    const payload = {
      ...(postId ? { id: postId } : {}),
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || null,
      content,
      cover_image: coverImage || null,
      category_id: categoryId || null,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      status: finalStatus,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDescription.trim() || null,
    };

    try {
      const res = await fetch("/api/blog", {
        method: postId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Erreur : ${data.error}`);
      } else {
        if (!postId) setPostId(data.id);
        setStatus(finalStatus);
        if (isNew) {
          router.replace(`/${locale}/admin/blog/${data.id}`);
        }
      }
    } catch {
      alert("Erreur sauvegarde");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0d0d14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push(`/${locale}/admin/blog`)}
            className="cursor-pointer text-sm text-white/40 hover:text-white transition"
          >
            ← Retour au blog
          </button>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
              status === "published"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-amber-500/20 text-amber-400"
            }`}>
              {status === "published" ? "Publié" : "Brouillon"}
            </span>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="cursor-pointer rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium hover:bg-white/20 transition disabled:opacity-50"
            >
              {saving ? "..." : "Sauvegarder"}
            </button>
            {status !== "published" && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {saving ? "..." : "Publier"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Cover image */}
        <div className="mb-6">
          {coverImage ? (
            <div className="group relative overflow-hidden rounded-2xl">
              <img src={coverImage} alt="Couverture" className="w-full max-h-80 object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="cursor-pointer rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition"
                >
                  Changer
                </button>
                <button
                  onClick={() => setCoverImage("")}
                  className="cursor-pointer rounded-lg bg-red-500/30 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/40 transition"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-sm text-white/30 hover:border-emerald-500/30 hover:text-white/50 transition"
            >
              📷 Ajouter une image de couverture
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleCoverUpload(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titre de l'article"
          className="w-full bg-transparent text-3xl font-bold text-white placeholder:text-white/20 focus:outline-none"
        />

        {/* Slug */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-white/20">pronos.club/blog/</span>
          <input
            type="text"
            value={slug}
            onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
            className="flex-1 bg-transparent text-xs text-emerald-400 focus:outline-none"
          />
        </div>

        {/* Meta row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">
              Catégorie
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="" className="bg-[#1a1a2e] text-white">Sans catégorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-[#1a1a2e] text-white">{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">
              Tags (séparés par virgule)
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="football, ligue 1, value bet"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">
              Extrait (résumé court)
            </label>
            <input
              type="text"
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="Résumé affiché dans les cartes"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Editor */}
        <div className="mt-8">
          <BlogEditor content={content} onChange={setContent} />
        </div>

        {/* SEO section */}
        <div className="mt-8">
          <button
            onClick={() => setShowSeo(!showSeo)}
            className="cursor-pointer flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition"
          >
            <span>{showSeo ? "▼" : "▶"}</span>
            <span>Options SEO</span>
          </button>
          {showSeo && (
            <div className="mt-4 space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">
                  Titre SEO (laisser vide = titre article)
                </label>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={e => setMetaTitle(e.target.value)}
                  placeholder={title || "Titre SEO"}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-white/20">{(metaTitle || title).length}/60 caractères</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">
                  Meta Description
                </label>
                <textarea
                  value={metaDescription}
                  onChange={e => setMetaDescription(e.target.value)}
                  placeholder={excerpt || "Description pour Google..."}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500 focus:outline-none resize-none"
                />
                <p className="mt-1 text-[10px] text-white/20">{(metaDescription || excerpt || "").length}/160 caractères</p>
              </div>
              <div className="rounded-lg bg-white p-4">
                <p className="text-sm text-blue-800 hover:underline cursor-pointer">
                  {metaTitle || title || "Titre de l'article"} — PRONOS.CLUB
                </p>
                <p className="text-xs text-green-700">
                  pronos.club/blog/{slug || "mon-article"}
                </p>
                <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                  {metaDescription || excerpt || "Description de l'article..."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}