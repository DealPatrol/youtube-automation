import { type NextRequest, NextResponse } from 'next/server'

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Redirect authenticated users away from auth pages
  const firebaseToken = request.cookies.get('firebase-token')?.value

  if (
    firebaseToken &&
    (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect unauthenticated users away from protected pages
  if (
    !firebaseToken &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/results') ||
      pathname.startsWith('/profile') ||
      pathname === '/')
  ) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
