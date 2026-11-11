"use client";
import dynamic from "next/dynamic";

// 브라우저 저장소·오디오·PDF 읽기를 쓰는 앱이라 서버 렌더링 없이 띄운다.
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Page() {
  return <App />;
}
