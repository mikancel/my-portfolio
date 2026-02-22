import "./globals.css";

export const metadata = {
  title: "mikancel.com",
  description: "mikancel's portfolio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" suppressHydrationWarning>
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&display=swap" rel="stylesheet" />  </head>
      <body style={{ fontFamily: "'LINESeedJP_OTF', 'LINESeed', sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}