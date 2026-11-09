import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyTok · 숏폼으로 공부하기",
  description: "강의자료 PDF를 AI가 숏폼 학습 카드와 즉석 퀴즈로 바꿔 주는 세로 스크롤 학습 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
