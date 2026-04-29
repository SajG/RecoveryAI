import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname === "/api/sync-from-bridge") {
          return true;
        }

        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/salespeople/:path*",
    "/escalations/:path*",
    "/recovery-plan/:path*",
    "/sync/:path*",
    "/settings/:path*",
  ],
};
