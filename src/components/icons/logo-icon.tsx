import type { SVGProps } from 'react';

export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15.5 6.5L12 3L8.5 6.5" />
      <path d="M12 3v10" />
      <path d="M8.5 17.5L12 21L15.5 17.5" />
      <path d="M12 13v8" />
      <path d="M5 12H2a10 10 0 0020 0h-3" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
