import { type NextRequest, NextResponse } from 'next/server'

export default function proxy(request: NextRequest) {
  // No authentication required - users can access all pages freely
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
