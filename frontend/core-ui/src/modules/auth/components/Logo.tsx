// Raco AI branding, 2026-10-22. See RACO-CHANGES.md.
import type { SVGProps } from 'react';
import { cn } from 'erxes-ui';
import { useAtomValue } from 'jotai';
import { currentOrganizationState } from 'ui-modules';

type LogoProps = SVGProps<SVGSVGElement> & { tone?: 'auto' | 'light' };

export const Logo = ({ className, tone = 'auto', ...props }: LogoProps) => {
  const organization = useAtomValue(currentOrganizationState);
  if (organization?.orgLogo) {
    return (
      <img
        src={organization.orgLogo}
        alt={organization.orgShortName || 'Raco AI'}
        className={cn('h-8 w-auto object-contain', className)}
      />
    );
  }
  return (
    <svg
      width="180"
      height="30"
      viewBox="0 0 450 73"
      role="img"
      aria-label="Raco AI"
      className={cn('shrink-0', className)}
      {...props}
    >
      <image
        href="/assets/raco-logo.png"
        width="450"
        height="73"
        className={
          tone === 'auto' ? 'brightness-0 dark:brightness-100' : undefined
        }
      />
    </svg>
  );
};

export const OrgLogoIcon = ({
  className,
  ...props
}: SVGProps<SVGSVGElement>) => {
  const organization = useAtomValue(currentOrganizationState);
  if (organization?.orgLogo) {
    return (
      <img
        src={organization.orgLogo}
        alt={organization.orgShortName || 'Raco AI'}
        className={cn('h-8 w-auto object-contain', className)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 78 73"
      overflow="hidden"
      role="img"
      aria-label="Raco AI"
      className={className}
      {...props}
    >
      <image
        href="/assets/raco-logo.png"
        width="450"
        height="73"
        className="brightness-0 dark:brightness-100"
      />
    </svg>
  );
};
