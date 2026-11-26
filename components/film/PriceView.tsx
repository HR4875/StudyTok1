"use client";
// 요금제 계획: 아직 결제는 없고, 출시 때 쓰려는 값을 보여 준다.
import { SubTop } from "./parts";

function Plan({ best, name, won, per, items, chip }: { best?: boolean; name: string; won: string; per: string; items: string[]; chip?: string }) {
  return (
    <div className={"plan" + (best ? " best" : "")}>
      <h3>
        {name}
        {chip ? <span className="chip">{chip}</span> : null}
      </h3>
      <div className="won">
        {won}
        <small>{per}</small>
      </div>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default function PriceView() {
  return (
    <>
      <SubTop />
      <div className="shead">
        <h1>요금제 계획</h1>
      </div>
      <p className="note">아직 결제 기능은 없고, 여기서는 돈이 나가지 않아요. 출시할 때 적용하려는 요금 계획입니다.</p>
      <div className="plans">
        <Plan name="무료" won="0원" per="" items={["공개 시리즈 모두 보기", "내 자료로 3편까지 만들기"]} />
        <Plan best name="시험 패스" won="4,900원" per=" / 7일" items={["시험 범위 한 과목을 통째로", "40편까지 만들기", "영상 속 질문과 확인 문제 포함"]} chip="시험 기간에" />
        <Plan name="월 구독" won="9,900원" per=" / 월" items={["매달 100편까지 만들기", "과목 수 제한 없음"]} />
      </div>
      <p className="fine mt16">한 편을 만드는 AI 비용은 계획 몫까지 합쳐 약 0.04달러로 쟀습니다. 환율 1,400원으로 55원쯤이에요.</p>
    </>
  );
}
