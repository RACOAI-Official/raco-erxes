// Raco AI branding, 2026-10-22. See RACO-CHANGES.md.
import { useAtomValue } from 'jotai';
import { currentOrganizationState } from 'ui-modules';
import { Logo } from './Logo';

export const DynamicBanner = () => {
  const organization = useAtomValue(currentOrganizationState);
  return (
    <aside className="raco-brand-panel hidden lg:flex lg:w-1/2 min-h-dvh relative overflow-hidden flex-col justify-between p-12 xl:p-16">
      <a
        href="https://racoai.io"
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit"
        aria-label="Visit Raco AI"
      >
        <Logo tone="light" className="h-9 w-auto" />
      </a>
      <div className="relative max-w-lg py-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff7864] mb-6">
          Raco AI / Your workspace
        </p>
        <h1 className="text-[clamp(2.25rem,4vw,4rem)] font-medium leading-[1.08] tracking-tight">
          {organization?.orgLoginText || (
            <>
              Connect AI
              <br />
              <span className="text-[#ff7864]">to your operations.</span>
            </>
          )}
        </h1>
        <p className="mt-6 max-w-sm text-base leading-7 text-[#d8d6cf]">
          {organization?.orgLoginDescription ||
            'Bring your customers, projects, and automated workflows together in one workspace.'}
        </p>
        <div className="mt-10 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-[#d8d6cf]">
          {['Customer relationships', 'Team operations', 'Applied AI'].map(
            (feature) => (
              <span key={feature} className="border border-white/20 px-3 py-2">
                {feature}
              </span>
            ),
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/20 pt-5 text-xs text-[#d8d6cf]">
        <span>Custom software. Applied AI.</span>
        <a
          href="https://racoai.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-white"
        >
          racoai.io ↗
        </a>
      </div>
    </aside>
  );
};
