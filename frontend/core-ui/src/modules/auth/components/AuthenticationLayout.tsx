// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import { Logo } from '@/auth/components/Logo';
import { Polygons } from './Polygons';

interface AuthenticationLayoutProps {
  children: React.ReactNode;
}
export const AuthenticationLayout = ({
  children,
}: AuthenticationLayoutProps) => {
  return (
    <div className="relative overflow-hidden lg:w-1/2 lg:flex-none flex-1 flex flex-col sm:pt-28 py-8 h-dvh bg-[radial-gradient(#F0F1FE,#F7F8FA)] dark:bg-[radial-gradient(#0D0D0D,#161616)]">
      <div className="px-1 sm:px-6 mx-auto w-full max-w-md flex flex-col gap-8 relative">
        <div className="absolute inset-0 hidden sm:block">
          <Polygons
            variant="light"
            className="absolute left-1/2 -translate-x-1/2 w-[170%] -top-[18.5%]"
          />
        </div>
        <Logo className="h-10 mx-auto text-primary relative hidden sm:block" />
        <div className="relative sm:min-h-144">
          <div className="rounded-xl shadow-xl overflow-hidden bg-sidebar">
            <div className="overflow-hidden">
              <div className="w-auto h-full bg-background p-6 pt-8 border border-t-0 rounded-b-xl -mx-px space-y-6">
                {children}
              </div>
              <div className="flex flex-col text-accent-foreground space-y-1 py-5 w-full m-0 px-0">
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
