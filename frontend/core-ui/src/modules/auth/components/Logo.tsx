// Raco AI local modifications: 2026-10-21. See RACO-CHANGES.md.
import type { SVGProps } from 'react';
import { useAtomValue } from 'jotai';
import { currentOrganizationState } from 'ui-modules';

type LogoProps = SVGProps<SVGSVGElement>;

export const Logo = ({ ...props }: LogoProps) => {
  const organization = useAtomValue(currentOrganizationState);
  if (organization?.orgLogo) {
    return (
      <img
        src={organization.orgLogo}
        alt={organization.orgShortName || 'Raco AI'}
        className="object-contain h-8 w-auto"
      />
    );
  }
  return (
    <svg
      width="160"
      height="40"
      viewBox="0 0 160 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Raco AI"
      {...props}
    >
      <rect width="40" height="40" rx="10" fill="currentColor" />
      <path
        d="M12 30V10h9a6 6 0 0 1 1 12l7 8h-7l-7-9h5a3 3 0 0 0 0-6h-3v15z"
        fill="white"
      />
      <text
        x="50"
        y="28"
        fill="currentColor"
        fontFamily="Inter, sans-serif"
        fontSize="25"
        fontWeight="600"
      >
        Raco AI
      </text>
    </svg>
  );
};

export const OrgLogoIcon = ({ ...props }: LogoProps) => {
  const organization = useAtomValue(currentOrganizationState);
  if (organization?.orgLogo) {
    return (
      <img
        src={organization.orgLogo}
        alt={organization.orgShortName || 'Raco AI'}
        className="object-contain h-8 w-auto"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Raco AI"
      {...props}
    >
      <rect width="40" height="40" rx="10" fill="currentColor" />
      <path
        d="M12 30V10h9a6 6 0 0 1 1 12l7 8h-7l-7-9h5a3 3 0 0 0 0-6h-3v15z"
        fill="white"
      />
    </svg>
  );
};
