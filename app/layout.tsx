import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "band.stream Shop",
    template: "%s · band.stream Shop",
  },
  description: "Boutique merch des artistes band.stream — vinyles, T-shirts, vidéo, accessoires.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
