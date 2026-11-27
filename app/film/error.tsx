"use client";
// 모션 쇼츠 화면을 그리다 예상하지 못한 오류가 났을 때 보이는 화면.
// 이 기기에 저장된 것이 원인일 수 있어서, 다시 시도하는 길과 저장된 것을 지우고 다시 여는 길을 함께 둔다.
import { Logo } from "@/components/film/parts";
import { resetSaved } from "@/lib/film/store";

export default function FilmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // 원인을 찾을 수 있게 콘솔에는 남긴다 (화면에는 내부 메시지를 보이지 않는다)
  console.error("[film]", error);
  return (
    <div className="film">
      <div className="wrap">
        <header className="top">
          <Logo />
        </header>
        <div className="shead">
          <h1>화면을 여는 중에 문제가 생겼어요</h1>
        </div>
        <p className="lead">다시 시도해도 같으면 이 기기에 저장된 기록을 지우고 다시 열 수 있어요. 지우면 본 기록과 내가 만든 시리즈가 사라집니다.</p>
        <div className="cta">
          <button className="btn primary" type="button" onClick={reset}>
            다시 시도
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              resetSaved();
              reset();
            }}
          >
            저장된 기록 지우고 다시 열기
          </button>
        </div>
      </div>
    </div>
  );
}
