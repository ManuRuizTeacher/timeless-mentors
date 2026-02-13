import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "TimelessMentors - Chat with AI Mentors",
  description:
    "Speak in real-time with AI-powered mentors. Choose your mentor and start a voice conversation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-inter bg-primary text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
