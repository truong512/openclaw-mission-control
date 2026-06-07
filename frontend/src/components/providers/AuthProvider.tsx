"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useEffect, useState, type ReactNode } from "react";

import { isLikelyValidClerkPublishableKey } from "@/auth/clerkKey";
import {
  clearLocalAuthToken,
  getLocalAuthToken,
  isLocalAuthMode,
} from "@/auth/localAuth";
import { LocalAuthLogin } from "@/components/organisms/LocalAuthLogin";

function LocalAuthBootShell() {
  return <div className="min-h-screen bg-app" aria-hidden="true" />;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const localMode = isLocalAuthMode();
  const [localAuthReady, setLocalAuthReady] = useState(false);
  const [hasLocalToken, setHasLocalToken] = useState(false);

  useEffect(() => {
    if (!localMode) {
      clearLocalAuthToken();
      return;
    }

    setHasLocalToken(!!getLocalAuthToken());
    setLocalAuthReady(true);
  }, [localMode]);

  if (localMode) {
    if (!localAuthReady) {
      return <LocalAuthBootShell />;
    }

    if (!hasLocalToken) {
      return (
        <LocalAuthLogin
          onAuthenticated={() => {
            setHasLocalToken(true);
          }}
        />
      );
    }

    return <>{children}</>;
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const afterSignOutUrl =
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL ?? "/";

  if (!isLikelyValidClerkPublishableKey(publishableKey)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl={afterSignOutUrl}
    >
      {children}
    </ClerkProvider>
  );
}
