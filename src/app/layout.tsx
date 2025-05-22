import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

// No need to call GeistSans() or GeistMono() with configuration here.
// The imported GeistSans and GeistMono objects are already configured.
// They will provide the necessary CSS variables like --font-geist-sans.

export const metadata: Metadata = {
  title: 'HiveLens',
  description: 'Index and search images from the Hive blockchain.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
