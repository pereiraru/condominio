import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Force password change on first login
    if (
      token?.mustChangePassword &&
      pathname !== '/change-password' &&
      !pathname.startsWith('/api/')
    ) {
      return NextResponse.redirect(new URL('/change-password', req.url));
    }

    // Admin-only routes
    const adminRoutes = ['/dashboard/admin', '/api/users'];
    const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

    if (isAdminRoute && token?.role !== 'admin') {
      // Redirect non-admins to dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/change-password', '/api/users/:path*'],
};
