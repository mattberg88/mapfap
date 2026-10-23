import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "mapfap — draw on a map",
  description: "Look around a map, draw on it, add labels and symbols, and export a PNG or JPG.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#14161a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23ff5a36'/%3E%3Cpath d='M5 8l4.5-1.5 5 1.5L19 6.5v10L14.5 18l-5-1.5L5 18z' fill='none' stroke='white' stroke-width='1.8' stroke-linejoin='round'/%3E%3C/svg%3E" />
      </head>
      <body>{children}</body>
    </html>
  );
}
