import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except API, static files, and _next
    "/((?!api|_next|.*\\..*).*)",
  ],
};
