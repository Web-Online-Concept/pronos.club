import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function translateWithClaude(text: string, targetLang: string, isHtml: boolean): Promise<string> {
  if (!text || !text.trim()) return "";

  const langLabel = targetLang === "en" ? "English" : "Spanish";
  const htmlInstruction = isHtml
    ? "IMPORTANT: The input is HTML content. Preserve ALL HTML tags, attributes, classes, and structure exactly as they are. Only translate the visible text content between tags. Do NOT translate URLs, CSS classes, or tag attributes."
    : "This is plain text. Translate it naturally.";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: `Translate the following from French to ${langLabel}. ${htmlInstruction}

Return ONLY the translated text, no explanations, no markdown backticks, no preamble.

---
${text}
---`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const translated = data.content?.[0]?.text?.trim() || "";
  return translated;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  // Fetch the post
  const { data: post, error: fetchError } = await supabaseAdmin
    .from("blog_posts")
    .select("title, excerpt, content, meta_title, meta_description")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  try {
    // Translate to EN and ES in parallel
    const [titleEn, titleEs, excerptEn, excerptEs, contentEn, contentEs, metaTitleEn, metaTitleEs, metaDescEn, metaDescEs] =
      await Promise.all([
        translateWithClaude(post.title || "", "en", false),
        translateWithClaude(post.title || "", "es", false),
        translateWithClaude(post.excerpt || "", "en", false),
        translateWithClaude(post.excerpt || "", "es", false),
        translateWithClaude(post.content || "", "en", true),
        translateWithClaude(post.content || "", "es", true),
        translateWithClaude(post.meta_title || post.title || "", "en", false),
        translateWithClaude(post.meta_title || post.title || "", "es", false),
        translateWithClaude(post.meta_description || post.excerpt || "", "en", false),
        translateWithClaude(post.meta_description || post.excerpt || "", "es", false),
      ]);

    // Update DB
    const { error: updateError } = await supabaseAdmin
      .from("blog_posts")
      .update({
        title_en: titleEn,
        title_es: titleEs,
        excerpt_en: excerptEn,
        excerpt_es: excerptEs,
        content_en: contentEn,
        content_es: contentEs,
        meta_title_en: metaTitleEn,
        meta_title_es: metaTitleEs,
        meta_description_en: metaDescEn,
        meta_description_es: metaDescEs,
      })
      .eq("id", postId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      translated: {
        title_en: titleEn.slice(0, 50) + "...",
        title_es: titleEs.slice(0, 50) + "...",
        content_en_length: contentEn.length,
        content_es_length: contentEs.length,
      },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}