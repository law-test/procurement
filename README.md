# 공공조달관리사 수험·학습·취업 지도

2026년 신설 국가자격 **공공조달관리사** 수험생을 위한 민간 정보 사이트. GitHub Pages 정적 사이트로 운영한다.

사이트: https://jodal.pro/

## 구조

```
index.html        홈
exam/             시험·접수 안내
about/            소개·정정 안내
assets/           공통 CSS·JS (site.css, site.js)
data/             공개판 학습 데이터(JSON). 빌드 산출물이며 직접 편집하지 않는다
tools/            원장(xlsx) → data/ JSON 빌드 스크립트
tests/            정적 사이트·데이터 검증, 네이버 로그인 회귀 테스트
.github/workflows/validate.yml   push/PR 자동 검증
supabase/         선택적 백엔드 SQL·Edge Function (별도 배포 필요)
```

## 원칙

- 시험 제도·일정·출제기준은 Q-Net과 관계기관의 공식 공고를 우선한다. 교재로 시험범위를 단정하지 않는다.
- 원문 사실 / 자체 해석 / 학습용 가정을 구분해 표시하고, 확인하지 못한 항목은 미확인으로 남긴다.
- 공식 예제문제의 원문·선지·정답 매핑과 상업용 수험서 파생 데이터는 공개하지 않는다. 공개판은 자체 문장으로 재작성한 것만 쓴다(`publish_scope`).
- 검수를 통과한 항목부터 공개한다. 준비되지 않은 화면을 목차만 먼저 열지 않는다.
- 자격 취득이 가점·취업·소득을 보장한다고 쓰지 않는다.

## 데이터 파이프라인 (단방향)

```
비공개 원장 추출 JSON  →  tools/build_pages.py / build_quiz.py  →  data/*.json + 정적 화면
```

원장과 JSON을 동시에 손으로 고치지 않는다. 빌드할 때마다 감사 리포트(근거 공란, 출제기준 미연결, 요율 불일치)를 남긴다.

현재 저장소에는 공개용 HTML·JSON 산출물과 생성기가 들어 있다. 전체 재생성에 필요한 `atoms_v005.json`과 `criteria273.json` 원본은 포함되어 있지 않으므로, 저장소만 복제한 환경에서는 현재 산출물을 검증·미리보기한다. 생성기의 기본 출력 경로는 이 저장소, 비공개 입력 경로는 `_private/build`이다. 재생성할 때는 `PPM_BUILD`를 원본 디렉터리, `PPM_OUT`을 저장소 절대 경로로 명시하고, 생성물 수정 사항을 생성기에도 반영한 뒤 차이를 확인한다. 원본이나 비공개 자료는 저장소에 추가하지 않는다.

## 로컬 확인

Python 3.10 이상, Node.js 24 이상을 사용한다. 외부 패키지 설치 없이 실행할 수 있다.

```sh
python tests/validate-site.py
node --test tests/*.cjs
python -m http.server 8000
```

마지막 명령을 실행한 상태에서 `http://localhost:8000`을 연다. `file://`로 HTML을 열면 JSON 불러오기가 제한되므로 HTTP 서버를 사용한다. Node 실행 파일이 PATH에 없다면 `python tests/validate-site.py --node /절대/경로/node`로 지정한다.

검증기는 내부 파일·앵커 링크, 중복 HTML ID, 카드·문항 스키마와 수량, 개념 페이지 연결, 선택지와 정답 인덱스, 외부 파일 및 인라인 JavaScript 문법을 검사한다. 외부 사이트의 응답, 법령·시험 정보의 정확성, 실제 브라우저 동작은 별도로 확인한다. 로그인 테스트는 가짜 제공자와 관리 API를 사용하며 실제 계정이나 네트워크를 사용하지 않는다.

## 배포

GitHub Pages는 현재 저장소의 정적 파일을 제공한다. 검증을 통과한 변경을 배포 브랜치에 반영하면 저장소에 설정된 Pages 방식에 따라 게시된다. `CNAME`에는 사용자 도메인 `jodal.pro`가 들어 있다. 이 저장소의 검증 워크플로 자체는 Pages 게시나 Supabase 배포를 수행하지 않는다.

`배포.bat`은 커밋·푸시를 수행하므로 실행 전에 `git diff`와 검증 결과를 확인한다. 기존 사이트 생성기를 실행하면 수동으로 수정한 HTML이 덮어써질 수 있다.

Supabase 파일은 선택 기능의 소스이며 현재 배포 여부를 나타내지 않는다. 네이버 로그인은 연결된 제공자 ID로 사용자를 식별하며 이메일 일치만으로 기존 계정을 연결하지 않는다. 신규 계정의 내부 주소와 기존 계정 연결에는 별도의 계정 관리 절차가 필요하다. 로그인 화면(`/login/`)·완료 화면(`/me/`)은 현재 정적 사이트에 포함되어 있지 않으므로, 이 함수만 배포해 로그인 기능을 활성화하지 않는다. 활성화 전에는 화면·리디렉션 허용 목록·SQL 권한·운영 환경에서의 OAuth 흐름을 함께 검증한다. 서비스 역할 키와 제공자 비밀 키는 서버 환경변수로만 설정한다.


## 공개 UI 재생성

`python tools/build_ui.py`는 `tools/templates/*.tpl`과 공개 JSON으로 홈·외우기·모의시험·소식을 다시 만든다. 화면 수정은 이 템플릿에도 반영한다. `python tools/build_legal.py`는 현재 기능 안내를 다시 만든다. 두 작업은 비공개 원본 없이 실행 가능하다. 다른 콘텐츠 생성기는 각자의 원본 입력이 필요하다.

각 페이지 생성기는 마지막에 `tools/finalize_site.py`를 실행하여 공통 스크립트·본문 바로가기·canonical·Open Graph·사이트맵을 갱신한다. HTML을 직접 수정한 뒤에는 `python tools/finalize_site.py`를 실행한다.

선택적 실제 브라우저 회귀 검사는 Playwright가 설치된 환경에서 `node tools/test_dialogs.cjs`로 실행한다. 기본 브라우저는 Chrome이며 `TEST_BROWSER_CHANNEL=msedge`로 Edge를 사용할 수 있다.
