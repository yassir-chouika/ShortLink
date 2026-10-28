import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shrtnr. | Short links, simply',
  description:
    'Make long links a little easier to share. Shorten a URL, copy your link, and pass it along with Shrtnr.',
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
