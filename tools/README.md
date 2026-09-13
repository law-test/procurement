# tools

비공개 원장 추출 JSON → `data/*.json`·HTML 생성 스크립트를 둔다.

- `build_pages.py` — `atoms_v005.json`·`criteria273.json`을 읽어 개념 페이지·카드 JSON을 생성한다.
- `build_quiz.py` — 원장 추출본에서 공개 문항 JSON을 생성한다.
- `build_ui.py`, `build_plan.py`, `build_links.py`, `build_errata.py`, `build_future.py`, `build_legal.py` — 해당 화면을 생성한다.
- `pack_standalone.py` — 미리보기용 독립 파일을 묶는다.

원본 추출 JSON은 이 저장소에 포함되어 있지 않다. 생성기는 `PPM_BUILD`(원본 경로), `PPM_OUT`(사이트 출력 경로)을 읽으며 기본값은 각각 `_private/build`와 저장소 루트다. 실행 전에 환경변수를 절대 경로로 지정한다. 생성기가 변경된 화면을 덮어쓰지 않도록 출력 차이와 공통 템플릿을 확인한다. 현재 정적 사이트를 확인하는 데 재생성은 필요하지 않다.

저장소 루트에서 `python tests/validate-site.py`로 공개 산출물의 링크·데이터·JavaScript를 검증한다. 이 검증은 법령의 정확성이나 공개 범위 심사를 대신하지 않는다. 원장 검수 리포트는 공개 가능한 것과 로컬 전용 자료를 구분한다.

원장 파일 자체는 `.gitignore`로 제외한다. 상용 교재에서 파생된 데이터는 공개 저장소에 올리지 않는다.


## 공개 UI 재생성

`python tools/build_ui.py`는 `tools/templates/*.tpl`과 공개 JSON으로 홈·외우기·모의시험·소식을 다시 만든다. 화면 수정은 이 템플릿에도 반영한다. `python tools/build_legal.py`는 현재 기능 안내를 다시 만든다. 두 작업은 비공개 원본 없이 실행 가능하다. 다른 콘텐츠 생성기는 각자의 원본 입력이 필요하다.

각 페이지 생성기는 마지막에 `tools/finalize_site.py`를 실행하여 공통 스크립트·본문 바로가기·canonical·Open Graph·사이트맵을 갱신한다. HTML을 직접 수정한 뒤에는 `python tools/finalize_site.py`를 실행한다.

선택적 실제 브라우저 회귀 검사는 Playwright가 설치된 환경에서 `node tools/test_dialogs.cjs`로 실행한다. 기본 브라우저는 Chrome이며 `TEST_BROWSER_CHANNEL=msedge`로 Edge를 사용할 수 있다.
