"use client";

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalAppHeader() {
  const { status } = useSession();
  const pathname = usePathname();

  // Hide header on home page ("/") when user is NOT authenticated AND on check page
  const hideHeader = (pathname === '/' && status !== 'authenticated') || pathname === '/check';

  if (hideHeader) {
    return null;
  }

  return <AppHeader />;
} 