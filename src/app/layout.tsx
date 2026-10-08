import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AD YouTube Research",
  description: "Investiga oportunidades en YouTube con datos reales.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
