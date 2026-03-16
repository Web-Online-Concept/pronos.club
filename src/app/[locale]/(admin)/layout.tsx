import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";

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
      {children}
    </>
  );
}
