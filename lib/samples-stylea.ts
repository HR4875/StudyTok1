// 스타일A 예시 덱: 표준편차 3부작(개념 2편 + 풀이) + 정규분포, 그리고 시험문제 탭에 들어갈 교재 문제.
// 숫자는 설명용으로 만든 가상 점수다. 계산은 손으로 검산했다 (B반 √200 ≈ 14.1, A반 √2 ≈ 1.4).
import type { Card, Deck, ExamProblem, StyleASpec } from "./schema";

const SD1: StyleASpec = {
  "title": "표준편차 1 퍼짐",
  "scenes": [
    {
      "type": "hook",
      "lines": [
        "평균은 둘 다",
        "70점인데",
        "왜 다른 반일까?"
      ],
      "accent": "왜 다른 반일까?",
      "kicker": "통계학"
    },
    {
      "type": "dots",
      "title": "두 반의 점수",
      "groups": [
        {
          "label": "A반",
          "values": [
            68,
            69,
            70,
            71,
            72
          ]
        },
        {
          "label": "B반",
          "values": [
            50,
            60,
            70,
            80,
            90
          ]
        }
      ],
      "unit": "점",
      "say": "평균은 같은 70점",
      "say2": "B반이 훨씬 넓게 퍼져 있다"
    },
    {
      "type": "scale",
      "title": "점수가 퍼진 정도",
      "left": "모여 있음",
      "right": "퍼져 있음",
      "marks": [
        {
          "label": "A반",
          "at": 0.12
        },
        {
          "label": "B반",
          "at": 0.85,
          "focus": true
        }
      ],
      "say": "평균만으로는 이 차이가 안 보인다"
    },
    {
      "type": "end",
      "term": "퍼짐",
      "takeaway": "평균이 같아도 퍼진 정도는 다르다",
      "mark": "퍼진 정도"
    }
  ],
  "series": {
    "name": "표준편차",
    "index": 1,
    "total": 3,
    "next": "평균까지의 거리"
  }
};

const SD2: StyleASpec = {
  "title": "표준편차 2 거리",
  "scenes": [
    {
      "type": "hook",
      "lines": [
        "퍼진 정도를",
        "숫자 하나로",
        "말할 수 있을까?"
      ],
      "accent": "숫자 하나로",
      "kicker": "통계학"
    },
    {
      "type": "dots",
      "title": "평균까지의 거리",
      "groups": [
        {
          "label": "A반",
          "values": [
            68,
            69,
            70,
            71,
            72
          ]
        },
        {
          "label": "B반",
          "values": [
            50,
            60,
            70,
            80,
            90
          ]
        }
      ],
      "unit": "점",
      "deviation": true,
      "sdLabel": "평균 거리",
      "say": "각 점에서 평균까지 선을 긋는다",
      "say2": "선이 길수록 많이 퍼진 것"
    },
    {
      "type": "define",
      "term": "표준편차",
      "full": "standard deviation",
      "desc": "값들이 평균에서 평균적으로 떨어진 거리",
      "mark": "평균적으로 떨어진 거리"
    },
    {
      "type": "bars",
      "title": "두 반의 표준편차",
      "items": [
        {
          "label": "A반",
          "value": 1.4
        },
        {
          "label": "B반",
          "value": 14.1
        }
      ],
      "unit": "점",
      "focus": 1,
      "illustrative": false,
      "say": "B반이 10배 더 퍼져 있다"
    },
    {
      "type": "end",
      "term": "표준편차",
      "takeaway": "평균에서 떨어진 거리의 평균이다",
      "mark": "거리의 평균"
    }
  ],
  "series": {
    "name": "표준편차",
    "index": 2,
    "total": 3,
    "next": "직접 계산해 보기"
  }
};

const NORMAL: StyleASpec = {
  "title": "정규분포",
  "scenes": [
    {
      "type": "hook",
      "lines": [
        "시험 점수는",
        "어디에 가장",
        "많이 몰릴까?"
      ],
      "accent": "많이 몰릴까?",
      "kicker": "통계학"
    },
    {
      "type": "curve",
      "title": "점수의 분포",
      "shape": "bell",
      "xLabel": "점수",
      "yLabel": "사람 수",
      "marks": [
        {
          "at": 0.5,
          "label": "평균",
          "focus": true
        }
      ],
      "say": "평균 근처에 가장 많이 몰린다"
    },
    {
      "type": "curve",
      "title": "표준편차가 커지면",
      "shape": "bell",
      "to": "wide",
      "xLabel": "점수",
      "yLabel": "사람 수",
      "marks": [
        {
          "at": 0.5,
          "label": "평균",
          "focus": true
        }
      ],
      "say": "모여 있으면 높고 좁다",
      "say2": "퍼질수록 낮고 넓어진다"
    },
    {
      "type": "define",
      "term": "정규분포",
      "full": "normal distribution",
      "desc": "평균을 중심으로 좌우가 같은 종 모양 분포",
      "mark": "종 모양 분포"
    },
    {
      "type": "number",
      "value": 68,
      "unit": "%",
      "title": "평균 ± 표준편차",
      "label": "전체의 약 68%가 이 안에 들어온다",
      "mark": "약 68%",
      "ratio": 0.68
    },
    {
      "type": "end",
      "term": "정규분포",
      "takeaway": "평균에 몰리고 양쪽으로 갈수록 드물다",
      "mark": "평균에 몰리고"
    }
  ]
};

const SOL_B: StyleASpec = {
  "title": "표준편차 3 풀이",
  "scenes": [
    {
      "type": "problem",
      "source": "교재 예제",
      "text": "B반 다섯 명의 점수가 50, 60, 70, 80, 90점이다. 이 반 점수의 표준편차를 구하라.",
      "given": [
        "50",
        "60",
        "70",
        "80",
        "90"
      ],
      "ask": "표준편차",
      "mark": "표준편차",
      "think": false
    },
    {
      "type": "table",
      "title": "거리를 재고 제곱한다",
      "cols": [
        {
          "head": "점수",
          "values": [
            50,
            60,
            70,
            80,
            90
          ]
        },
        {
          "head": "− 평균 70",
          "values": [
            "−20",
            "−10",
            "0",
            "+10",
            "+20"
          ]
        },
        {
          "head": "제곱",
          "values": [
            400,
            100,
            0,
            100,
            400
          ]
        }
      ],
      "result": {
        "label": "제곱의 평균",
        "value": "200"
      },
      "say": "음수가 지워지도록 제곱한다"
    },
    {
      "type": "solve",
      "title": "마지막 두 줄",
      "steps": [
        {
          "label": "제곱을 모두 더해 5로 나눈다",
          "expr": "1000 ÷ 5",
          "result": "200"
        },
        {
          "label": "제곱했으니 제곱근으로 되돌린다",
          "expr": "√200",
          "result": "14.1"
        }
      ],
      "answer": "약 14.1점",
      "answerLabel": "표준편차"
    },
    {
      "type": "end",
      "term": "계산 순서",
      "takeaway": "거리, 제곱, 평균, 제곱근 순서다",
      "mark": "거리, 제곱, 평균, 제곱근"
    }
  ]
};

const SOL_A: StyleASpec = {
  "title": "A반 표준편차 풀이",
  "scenes": [
    {
      "type": "problem",
      "source": "교재 연습 1",
      "text": "A반 다섯 명의 점수가 68, 69, 70, 71, 72점이다. 이 반 점수의 표준편차를 구하라.",
      "given": [
        "68",
        "69",
        "70",
        "71",
        "72"
      ],
      "ask": "표준편차",
      "mark": "표준편차",
      "think": false
    },
    {
      "type": "table",
      "title": "거리를 재고 제곱한다",
      "cols": [
        {
          "head": "점수",
          "values": [
            68,
            69,
            70,
            71,
            72
          ]
        },
        {
          "head": "− 평균 70",
          "values": [
            "−2",
            "−1",
            "0",
            "+1",
            "+2"
          ]
        },
        {
          "head": "제곱",
          "values": [
            4,
            1,
            0,
            1,
            4
          ]
        }
      ],
      "result": {
        "label": "제곱의 평균",
        "value": "2"
      },
      "say": "음수가 지워지도록 제곱한다"
    },
    {
      "type": "solve",
      "title": "마지막 두 줄",
      "steps": [
        {
          "label": "제곱을 모두 더해 5로 나눈다",
          "expr": "10 ÷ 5",
          "result": "2"
        },
        {
          "label": "제곱했으니 제곱근으로 되돌린다",
          "expr": "√2",
          "result": "1.4"
        }
      ],
      "answer": "약 1.4점",
      "answerLabel": "표준편차"
    },
    {
      "type": "end",
      "term": "계산 순서",
      "takeaway": "거리, 제곱, 평균, 제곱근 순서다",
      "mark": "거리, 제곱, 평균, 제곱근"
    }
  ]
};

const SOL_COMPARE: StyleASpec = {
  "title": "표준편차 비교 풀이",
  "scenes": [
    {
      "type": "problem",
      "source": "교재 연습 2",
      "text": "두 반의 평균은 모두 70점이고, 표준편차는 A반 1.4점, B반 14.1점이다. 점수가 더 고른 반은?",
      "given": [
        "A반 1.4점",
        "B반 14.1점"
      ],
      "ask": "더 고른 반",
      "mark": "더 고른 반",
      "think": false
    },
    {
      "type": "dots",
      "title": "평균까지의 거리",
      "groups": [
        {
          "label": "A반",
          "values": [
            68,
            69,
            70,
            71,
            72
          ]
        },
        {
          "label": "B반",
          "values": [
            50,
            60,
            70,
            80,
            90
          ]
        }
      ],
      "unit": "점",
      "deviation": true,
      "sdLabel": "평균 거리",
      "say": "표준편차는 평균까지의 거리",
      "say2": "선이 짧은 A반이 더 모여 있다"
    },
    {
      "type": "bars",
      "title": "두 반의 표준편차",
      "items": [
        {
          "label": "A반",
          "value": 1.4
        },
        {
          "label": "B반",
          "value": 14.1
        }
      ],
      "unit": "점",
      "focus": 0,
      "illustrative": false,
      "say": "작을수록 점수가 고르다"
    },
    {
      "type": "end",
      "term": "A반",
      "takeaway": "표준편차가 작을수록 점수가 고르다",
      "mark": "작을수록"
    }
  ]
};

const SOL_NORMAL: StyleASpec = {
  "title": "정규분포 68% 풀이",
  "scenes": [
    {
      "type": "problem",
      "source": "교재 연습 3",
      "text": "어느 시험 점수가 평균 70점, 표준편차 10점인 정규분포를 따른다. 60점과 80점 사이의 학생은 전체의 약 몇 %인가?",
      "given": [
        "평균 70점",
        "표준편차 10점"
      ],
      "ask": "60~80점의 비율",
      "mark": "약 몇 %",
      "think": false
    },
    {
      "type": "solve",
      "title": "평균에서 얼마나 떨어졌나",
      "steps": [
        {
          "label": "60점은 평균보다 표준편차 하나 아래",
          "expr": "70 − 10",
          "result": "60"
        },
        {
          "label": "80점은 평균보다 표준편차 하나 위",
          "expr": "70 + 10",
          "result": "80"
        }
      ],
      "answer": "약 68%",
      "answerLabel": "평균 ± 표준편차 1개"
    },
    {
      "type": "curve",
      "title": "종 모양의 가운데",
      "shape": "bell",
      "xLabel": "점수",
      "yLabel": "사람 수",
      "marks": [
        {
          "at": 0.34,
          "label": "60점"
        },
        {
          "at": 0.5,
          "label": "평균 70점",
          "focus": true
        },
        {
          "at": 0.66,
          "label": "80점"
        }
      ],
      "say": "이 구간에 약 68%가 들어온다"
    },
    {
      "type": "end",
      "term": "약 68%",
      "takeaway": "평균 ± 표준편차 한 개 안에 약 68%",
      "mark": "약 68%"
    }
  ]
};

const concept = (term: string, definition: string, explanation: string, keyPoints: string[], example: string) => ({
  term,
  definition,
  explanation,
  keyPoints,
  example,
  visual: "",
  pages: "",
});

const CARDS: Card[] = [
  {
    id: "sample-sa-sd1",
    concept: concept(
      "표준편차 1 · 퍼짐",
      "평균이 같아도 값이 퍼진 정도는 다를 수 있다",
      "A반과 B반은 평균이 모두 70점이지만, A반은 68~72점에 모여 있고 B반은 50~90점까지 넓게 퍼져 있다. 평균만 보면 이 차이가 보이지 않는다.",
      ["평균은 가운데 위치만 알려 준다", "퍼진 정도는 따로 재야 한다"],
      "A반 68, 69, 70, 71, 72점 / B반 50, 60, 70, 80, 90점",
    ),
    scene: null,
    spec: SD1,
    status: "ready",
  },
  {
    id: "sample-sa-sd2",
    concept: concept(
      "표준편차 2 · 거리",
      "값들이 평균에서 평균적으로 떨어진 거리",
      "각 값에서 평균까지의 거리를 재고, 그 거리들의 평균을 낸 것이 표준편차다. 계산할 때는 거리를 제곱해 평균을 낸 뒤 제곱근으로 되돌린다.",
      ["표준편차가 클수록 값이 넓게 퍼져 있다", "계산 순서: 거리 → 제곱 → 평균 → 제곱근"],
      "A반 약 1.4점, B반 약 14.1점",
    ),
    scene: null,
    spec: SD2,
    quiz: {
      question: "표준편차가 알려 주는 것은?",
      options: ["값들이 평균에서 떨어진 정도", "가장 자주 나온 값", "값을 모두 더한 합", "가장 큰 값과 작은 값의 합"],
      answer: 0,
      explanation: "표준편차는 값들이 평균에서 평균적으로 얼마나 떨어져 있는지를 나타내요. 클수록 넓게 퍼져 있어요.",
    },
    status: "ready",
  },
  {
    id: "sample-sa-normal",
    concept: concept(
      "정규분포",
      "평균을 중심으로 좌우가 같은 종 모양 분포",
      "값이 평균 근처에 가장 많이 몰리고, 평균에서 멀어질수록 드물어지는 분포다. 표준편차가 커지면 종이 낮고 넓어진다.",
      ["평균 ± 표준편차 한 개 안에 약 68%", "표준편차가 클수록 종이 납작해진다"],
      "평균 70점, 표준편차 10점이면 60~80점에 약 68%",
    ),
    scene: null,
    spec: NORMAL,
    quiz: {
      question: "정규분포에서 값이 가장 많이 몰리는 곳은?",
      options: ["평균 근처", "가장 작은 값 근처", "가장 큰 값 근처", "양쪽 끝"],
      answer: 0,
      explanation: "정규분포는 평균을 중심으로 한 종 모양이에요. 평균 근처에 가장 많고 양쪽 끝으로 갈수록 드물어요.",
    },
    status: "ready",
  },
];

const PROBLEMS: ExamProblem[] = [
  {
    id: "sample-sa-p1",
    concept: "표준편차",
    source: "교재 예제",
    text: "B반 다섯 명의 점수가 50, 60, 70, 80, 90점이다. 이 반 점수의 표준편차를 구하라. (소수 첫째 자리까지)",
    given: ["50", "60", "70", "80", "90"],
    ask: "표준편차",
    answer: "약 14.1점",
    explanation: "평균은 70점. 평균까지의 거리 −20, −10, 0, +10, +20을 제곱하면 400, 100, 0, 100, 400. 더해서 5로 나누면 200, 제곱근은 약 14.1.",
    solution: SOL_B,
  },
  {
    id: "sample-sa-p2",
    concept: "표준편차",
    source: "교재 연습 1",
    text: "A반 다섯 명의 점수가 68, 69, 70, 71, 72점이다. 이 반 점수의 표준편차는?",
    given: ["68", "69", "70", "71", "72"],
    ask: "표준편차",
    options: ["약 1.4점", "2점", "약 14.1점", "10점"],
    answerIndex: 0,
    answer: "약 1.4점",
    explanation: "평균은 70점. 거리의 제곱은 4, 1, 0, 1, 4. 더해서 5로 나누면 2, 제곱근은 약 1.4. 2점은 제곱근을 씌우기 전 값이다.",
    solution: SOL_A,
  },
  {
    id: "sample-sa-p3",
    concept: "표준편차",
    source: "교재 연습 2",
    text: "두 반의 평균은 모두 70점이고, 표준편차는 A반 1.4점, B반 14.1점이다. 옳은 설명은?",
    given: ["A반 1.4점", "B반 14.1점"],
    options: ["A반 점수가 더 고르다", "B반 점수가 더 고르다", "두 반은 점수 분포가 같다", "B반 평균이 더 높다"],
    answerIndex: 0,
    answer: "A반 점수가 더 고르다",
    explanation: "표준편차가 작을수록 값들이 평균 가까이에 모여 있다. A반이 1.4점으로 더 작으므로 더 고르다.",
    solution: SOL_COMPARE,
  },
  {
    id: "sample-sa-p4",
    concept: "정규분포",
    source: "교재 연습 3",
    text: "어느 시험 점수가 평균 70점, 표준편차 10점인 정규분포를 따른다. 60점과 80점 사이의 학생은 전체의 약 몇 %인가?",
    given: ["평균 70점", "표준편차 10점"],
    ask: "60~80점의 비율",
    options: ["약 34%", "약 50%", "약 68%", "약 95%"],
    answerIndex: 2,
    answer: "약 68%",
    explanation: "60점과 80점은 평균 70점에서 표준편차 하나(10점)씩 떨어진 값이다. 정규분포에서 평균 ± 표준편차 한 개 안에는 약 68%가 들어온다.",
    solution: SOL_NORMAL,
  },
];

export const STYLEA_DECK: Deck = {
  id: "sample-stylea",
  title: "표준편차와 정규분포",
  subject: "통계학",
  source: "설명용 예시 자료",
  createdAt: Date.UTC(2026, 10, 25),
  sample: true,
  cards: CARDS,
  problems: PROBLEMS,
};
