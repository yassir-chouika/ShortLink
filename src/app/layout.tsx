import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shrtnr. | Short links, simply',
  description:
    'A simpler way to shorten, share, and understand your links. Coming soon.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
