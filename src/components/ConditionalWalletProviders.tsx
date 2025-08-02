'use client';

import { usePathname } from 'next/navigation';
import SessionProviderWrapper from '@/providers/sessionProviderWrapper';
import { WalletAdapterProvider } from '@/providers/walletAdapterProvider';
import { UmiProvider } from '@/providers/umiProvider';
import { ThemeProviderWrapper } from '@/providers/themeProvider';

interface ConditionalWalletProvidersProps {
  children: React.ReactNode;
}

export default function ConditionalWalletProviders({ children }: ConditionalWalletProvidersProps) {
  const pathname = usePathname();
  
  // Don't load wallet providers on the check page since it doesn't need wallet functionality
  const isCheckPage = pathname === '/check';

  if (isCheckPage) {
    return (
      <ThemeProviderWrapper>
        {children}
      </ThemeProviderWrapper>
    );
  }

  return (
    <SessionProviderWrapper>
      <WalletAdapterProvider>
        <UmiProvider>
          <ThemeProviderWrapper>
            {children}
          </ThemeProviderWrapper>
        </UmiProvider>
      </WalletAdapterProvider>
    </SessionProviderWrapper>
  );
} 