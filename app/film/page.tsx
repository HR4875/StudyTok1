"use client";
import dynamic from "next/dynamic";

// 브라우저 저장소·오디오·PDF 읽기를 쓰는 화면이라 서버 렌더링 없이 띄운다.
const FilmApp = dynamic(() => import("@/components/film/FilmApp"), { ssr: false, loading: () => <div className="film" /> });

export default function FilmPage() {
  return <FilmApp />;
}
