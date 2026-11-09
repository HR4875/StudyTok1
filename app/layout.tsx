import type { Metadata, Viewport } from "next";
import { Black_Han_Sans } from "next/font/google";
// 본문 폰트: Pretendard (npm 패키지로 직접 넣음. 한국어 글리프를 쓰는 만큼만 나눠 받는 dynamic subset)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 큰 개념 이름·제목용 디스플레이 폰트 (Google Fonts, 빌드 때 내려받아 같이 배포)
const display = Black_Han_Sans({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-display", preload: false });

export const metadata: Metadata = {
  title: "StudyTok · 숏폼으로 공부하기",
  description: "강의자료 PDF를 AI가 숏폼 학습 카드와 즉석 퀴즈로 바꿔 주는 세로 스크롤 학습 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4F72FF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
