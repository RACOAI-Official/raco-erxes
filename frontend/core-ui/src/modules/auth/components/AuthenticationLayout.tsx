// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import { Logo } from '@/auth/components/Logo';

interface AuthenticationLayoutProps {
  children: React.ReactNode;
}
export const AuthenticationLayout = ({
  children,
}: AuthenticationLayoutProps) => {
  return (
    <div className="relative overflow-y-auto lg:w-1/2 lg:flex-none flex-1 flex flex-col justify-center py-10 min-h-dvh bg-sidebar">
      <div className="px-1 sm:px-6 mx-auto w-full max-w-md flex flex-col gap-8 relative">
        <Logo className="h-9 w-auto mx-auto relative" />
        <div className="relative">
          <div className="rounded-lg border shadow-sm overflow-hidden bg-background">
            <div className="overflow-hidden">
              <div className="w-auto h-full bg-background p-6 sm:p-8 space-y-6">
                {children}
              </div>
              <div className="flex flex-col text-muted-foreground space-y-1 border-t py-5 w-full m-0 px-3">
                <span className="text-sm text-center">
                  Raco AI · Based on erxes ·{' '}
                  <a
                    className="text-primary hover:underline"
                    href="/assets/raco-source.tar.gz"
                    download
                  >
                    Source code and license
                  </a>
                </span>
                <span className="text-sm text-center">
                  Self-hosted CRM · GNU AGPLv3
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
