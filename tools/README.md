# tools

원장(xlsx) → `data/*.json` 빌드 스크립트를 둔다.

- `build_atoms.py` — atom 원장에서 `publish_scope=공개`인 항목만 추려 과목별 JSON으로 내보낸다. (작성 예정)
- 감사 리포트는 `reports/`에 남긴다. 저장소에 올릴 리포트와 로컬 전용 리포트를 구분한다.

원장 파일 자체는 `.gitignore`로 제외한다. 상용 교재에서 파생된 데이터는 공개 저장소에 올리지 않는다.
