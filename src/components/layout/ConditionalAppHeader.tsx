"use client";

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalAppHeader() {
  const pathname = usePathname();
  // Always call useSession - it will return undefined if there's no provider
  const sessionResult = useSession();
  
  // Hide header on check page
  if (pathname === '/check') {
    return null;
  }

  // Get status, defaulting to 'unauthenticated' if session is undefined
  const status = sessionResult?.status || 'unauthenticated';

  // Hide header on home page ("/") when user is NOT authenticated
  const hideHeader = pathname === '/' && status !== 'authenticated';

  if (hideHeader) {
    return null;
  }

  return <AppHeader />;
} 