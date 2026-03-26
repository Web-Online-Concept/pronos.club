"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  status: "draft" | "published";
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  blog_categories: Category | null;
}

export default function AdminBlogPage() {
  const { locale } = useParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/blog?admin=true&limit=100");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer l'article "${title}" ? Cette action est irréversible.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/blog?id=${id}`, { method: "DELETE" });
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
    setDeleting(null);
  };

  const handleToggleStatus = async (post: Post) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    try {
      await fetch("/api/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, status: newStatus }),
      });
      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, status: newStatus } : p
      ));
    } catch { /* ignore */ }
  };

  const filtered = posts.filter(p => filter === "all" || p.status === filter);
  const draftCount = posts.filter(p => p.status === "draft").length;
  const publishedCount = posts.filter(p => p.status === "published").length;

  const fmt = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0d0d14]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={`/${locale}/admin`}
                className="mb-2 inline-block text-xs text-white/30 hover:text-white/60 transition"
              >
                ← Dashboard admin
              </Link>
              <h1 className="text-2xl font-bold">Blog</h1>
              <p className="mt-1 text-sm text-white/40">
                {posts.length} article{posts.length > 1 ? "s" : ""} · {publishedCount} publié{publishedCount > 1 ? "s" : ""} · {draftCount} brouillon{draftCount > 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href={`/${locale}/admin/blog/new`}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition"
            >
              + Nouvel article
            </Link>
          </div>

          {/* Filters */}
          <div className="mt-4 flex gap-2">
            {(["all", "published", "draft"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filter === f
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {f === "all" ? `Tous (${posts.length})` :
                 f === "published" ? `Publiés (${publishedCount})` :
                 `Brouillons (${draftCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl">📝</p>
            <p className="mt-4 text-lg font-medium text-white/60">
              {filter === "all" ? "Aucun article pour le moment" : `Aucun article ${filter === "draft" ? "en brouillon" : "publié"}`}
            </p>
            <Link
              href={`/${locale}/admin/blog/new`}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition"
            >
              Créer le premier article
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(post => (
              <div
                key={post.id}
                className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition"
              >
                {/* Cover thumbnail */}
                <div className="hidden sm:block h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.05]">
                  {post.cover_image ? (
                    <img src={post.cover_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl text-white/10">
                      {post.blog_categories?.icon || "📄"}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      post.status === "published"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {post.status === "published" ? "Publié" : "Brouillon"}
                    </span>
                    {post.blog_categories && (
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${post.blog_categories.color}20`,
                          color: post.blog_categories.color,
                        }}
                      >
                        {post.blog_categories.icon} {post.blog_categories.name}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-semibold">{post.title}</h3>
                  <p className="mt-0.5 text-xs text-white/30">
                    {post.status === "published" ? `Publié le ${fmt(post.published_at)}` : `Créé le ${fmt(post.created_at)}`}
                    {" · "}{post.view_count} vue{post.view_count > 1 ? "s" : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  {post.status === "published" && (
                    <Link
                      href={`/${locale}/blog/${post.slug}`}
                      target="_blank"
                      className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:text-white transition"
                    >
                      Voir
                    </Link>
                  )}
                  <Link
                    href={`/${locale}/admin/blog/${post.id}`}
                    className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/30 transition"
                  >
                    Modifier
                  </Link>
                  <button
                    onClick={() => handleToggleStatus(post)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition ${
                      post.status === "published"
                        ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    }`}
                  >
                    {post.status === "published" ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    onClick={() => handleDelete(post.id, post.title)}
                    disabled={deleting === post.id}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    {deleting === post.id ? "..." : "Supprimer"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}