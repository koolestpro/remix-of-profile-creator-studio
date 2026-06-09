import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export function GoogleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3a12 12 0 0 1-18.1-6L6.6 32.4A20 20 0 0 0 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C37 39 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <defs>
        <radialGradient id="ig-g" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#ig-g)"/>
      <circle cx="24" cy="24" r="8" fill="none" stroke="#fff" strokeWidth="2.5"/>
      <circle cx="34" cy="14" r="2" fill="#fff"/>
      <rect x="10" y="10" width="28" height="28" rx="8" fill="none" stroke="#fff" strokeWidth="2.5"/>
    </svg>
  );
}

export function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect width="48" height="48" rx="10" fill="#000"/>
      <path fill="#25F4EE" d="M30 12.5c.4 3.5 2.4 5.6 5.8 5.8v4c-2 0-3.9-.6-5.8-1.7v8.7c0 5.5-4 9.7-9.4 9.7-2.1 0-3.9-.6-5.4-1.7 7.1 1.3 10.8-3.3 10.8-9.7V18.7c1.9 1.1 3.8 1.7 5.8 1.7v-4c-.5-.1-1-.3-1.4-.4z" opacity=".9"/>
      <path fill="#FE2C55" d="M32 14.5c.4 3.5 2.4 5.6 5.8 5.8v4c-2 0-3.9-.6-5.8-1.7v8.7c0 5.5-4 9.7-9.4 9.7s-9.4-4.2-9.4-9.7c0-5.4 4.4-9.7 9.8-9.5v4.2c-.4-.1-.9-.2-1.4-.2-2.7 0-4.9 2.3-4.9 5.1s2.2 5.1 4.9 5.1c2.7 0 5.1-2.2 5.1-5l.1-19.5h4.4c.3 2 1.5 3.7 3.2 4.6z"/>
      <path fill="#fff" d="M31 13.5c.4 3.5 2.4 5.6 5.8 5.8v4c-2 0-3.9-.6-5.8-1.7v8.7c0 5.5-4 9.7-9.4 9.7s-9.4-4.2-9.4-9.7c0-5.4 4.4-9.7 9.8-9.5v4.2c-.4-.1-.9-.2-1.4-.2-2.7 0-4.9 2.3-4.9 5.1s2.2 5.1 4.9 5.1c2.7 0 5.1-2.2 5.1-5L25.8 10h4.4c.3 2 .5 2.5.8 3.5z"/>
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="22" fill="#1877F2"/>
      <path fill="#fff" d="M27.5 25.5h4l.7-5.2h-4.7v-3.3c0-1.5.4-2.5 2.6-2.5h2.8V9.8c-.5-.1-2.1-.2-4-.2-4 0-6.7 2.4-6.7 6.9v3.8h-4.5v5.2h4.5V42h5.3V25.5z"/>
    </svg>
  );
}

export function TripadvisorIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="22" fill="#00AA6C"/>
      <circle cx="16" cy="24" r="6" fill="#fff"/>
      <circle cx="32" cy="24" r="6" fill="#fff"/>
      <circle cx="16" cy="24" r="2.5" fill="#000"/>
      <circle cx="32" cy="24" r="2.5" fill="#000"/>
      <path fill="#fff" d="M24 14c-3-1.5-7-2-11-2l3 4h16l3-4c-4 0-8 .5-11 2z"/>
    </svg>
  );
}

export function TrustpilotIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect width="48" height="48" rx="6" fill="#00B67A"/>
      <path fill="#fff" d="M24 8l4.2 9.6 10.4.8-7.9 6.8 2.5 10.2L24 30l-9.2 5.4 2.5-10.2-7.9-6.8 10.4-.8z"/>
    </svg>
  );
}

export function WebsiteIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="22" fill="#2563EB"/>
      <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" strokeWidth="2"/>
      <ellipse cx="24" cy="24" rx="6" ry="14" fill="none" stroke="#fff" strokeWidth="2"/>
      <path stroke="#fff" strokeWidth="2" d="M10 24h28M24 10v28"/>
    </svg>
  );
}

export function AppStoreIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect width="48" height="48" rx="10" fill="#000"/>
      <path fill="#fff" d="M32.5 25.3c0-3.4 2.8-5 2.9-5.1-1.6-2.3-4-2.6-4.9-2.7-2.1-.2-4.1 1.2-5.1 1.2s-2.7-1.2-4.4-1.2c-2.3 0-4.4 1.3-5.6 3.4-2.4 4.1-.6 10.2 1.7 13.5 1.1 1.6 2.5 3.5 4.2 3.4 1.7-.1 2.3-1.1 4.4-1.1s2.7 1.1 4.4 1c1.8 0 3-1.6 4.1-3.3 1.3-1.9 1.8-3.7 1.9-3.8-.1 0-3.6-1.4-3.6-5.3zM29.3 15.3c.9-1.1 1.5-2.7 1.4-4.3-1.3.1-3 .9-3.9 2-.9 1-1.6 2.6-1.4 4.1 1.5.1 3-.7 3.9-1.8z"/>
    </svg>
  );
}

export function GooglePlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect width="48" height="48" rx="10" fill="#fff"/>
      <path fill="#00C2FF" d="M15 11.5v25c0 .8.3 1.4.8 1.7l13.1-14.2L15.8 9.8c-.5.3-.8.9-.8 1.7z"/>
      <path fill="#FFCE00" d="M33.5 21.3l-4.6-2.6-4.4 4.8 4.4 4.8 4.6-2.6c1.5-.9 1.5-3.5 0-4.4z"/>
      <path fill="#FF3A44" d="M28.9 18.7L15.8 9.8c-.3-.2-.7-.3-1.1-.2L25.5 23l3.4-4.3z"/>
      <path fill="#00E676" d="M28.9 29.3L25.5 25 14.7 38.4c.4.1.8 0 1.1-.2l13.1-8.9z"/>
    </svg>
  );
}

export function LoyaltyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <rect width="48" height="48" rx="10" fill="#7C3AED"/>
      <path fill="#FFD700" d="M24 10l3.6 7.3 8 1.2-5.8 5.7 1.4 8L24 28.4l-7.2 3.8 1.4-8L12.4 18.5l8-1.2z"/>
      <path fill="#fff" d="M14 30h20v8H14z" opacity=".9"/>
      <path fill="#7C3AED" d="M22 30h4v8h-4z"/>
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <circle cx="24" cy="24" r="22" fill="#25D366"/>
      <path fill="#fff" d="M34.6 13.4A14.6 14.6 0 0 0 11.6 31l-2 7.4 7.5-2A14.6 14.6 0 0 0 38.7 24c0-3.9-1.5-7.6-4.1-10.6zm-10.7 22.4c-2.2 0-4.4-.6-6.3-1.7l-.5-.3-4.5 1.2 1.2-4.4-.3-.5a12.1 12.1 0 1 1 22.5-6.2c0 6.7-5.5 11.9-12.1 11.9zm6.6-8.9c-.4-.2-2.1-1-2.4-1.2-.3-.1-.6-.2-.8.2-.2.4-.9 1.2-1.2 1.4-.2.2-.4.3-.8 0-.4-.2-1.5-.6-2.9-1.8a11 11 0 0 1-2-2.5c-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.3.3-.6.1-.2.1-.4 0-.6 0-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-1 .4-.3.4-1.3 1.3-1.3 3.1 0 1.9 1.4 3.6 1.5 3.9.2.2 2.7 4.1 6.5 5.7 3.8 1.5 3.8 1 4.5.9.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.2-.4-.3-.8-.5z"/>
    </svg>
  );
}
