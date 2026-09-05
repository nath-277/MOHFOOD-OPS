import { redirect } from "next/navigation";

export default function HomePage() {
  // Middleware intercepts / and redirects based on session; this serves as server-side fallback
  redirect("/login");
}
