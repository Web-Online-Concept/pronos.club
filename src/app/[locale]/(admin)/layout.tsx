import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/fr/login");
  }

  if (!user.is_admin) {
    redirect("/fr");
  }

  return (
    <>
      <Navbar />
      {/* Admin indicator bar */}
      <div
        className="border-b border-red-500/20"
        style={{ background: "linear-gradient(90deg, #1a0505 0%, #2e0a0a 50%, #1a0505 100%)" }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 px-4 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.35em] text-red-400">
            Administration
          </span>
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        </div>
      </div>
      <div
        className="min-h-screen"
        style={{ background: "linear-gradient(180deg, #2a3240 0%, #313b4a 100%)" }}
      >
        {children}
      </div>
    </>
  );
}