# FF14 Lookbook v2

## 기능 요약

- 아이템 이름 검색 → **Garland Tools API**로 아이콘 자동 표시
- 아이템 카드가 **사진 위에 직접 오버레이** (이미지1 스타일)
- 카드 위치 **드래그로 자유 조정**
- **솔로 / 페어** 모드 전환
- 모든 데이터 **브라우저 자동 저장** (localStorage)
- **PNG 다운로드** 기능

---

## 사용 방법

### 룩 만들기
1. **새 룩 만들기** 버튼 클릭
2. 세트 이름 입력
3. 이미지 드래그 or 클릭해서 업로드
4. 슬롯(머리/몸통 등) 클릭 → 아이템명 검색 → 염색 입력
5. 글램 카드를 드래그해서 위치 조정
6. **저장** 버튼

### 아이템 검색 팁
- **영어 이름**으로 검색하면 결과가 가장 많아요
- 예: `Vanguard Scout Bolero`, `YoRHa Type-52 Leggings of Maiming`
- 한국어 이름도 일부 작동해요

---

## GitHub Pages로 배포 (무료 링크 만들기)

1. [github.com](https://github.com) 에서 새 레포 만들기  
   이름 예시: `ff14-lookbook`

2. 레포에 세 파일 올리기:
   ```
   index.html
   style.css
   app.js
   ```

3. 레포 상단 **Settings** 탭 클릭

4. 왼쪽 **Pages** 메뉴

5. **Source** → `Deploy from a branch` → Branch: `main` → `/ (root)` → **Save**

6. 1~2분 후 아래 주소로 접속 가능:
   ```
   https://[내깃헙아이디].github.io/ff14-lookbook/
   ```

> 이 링크를 지인에게 공유하면 바로 접속 가능!  
> 각자의 브라우저에 데이터가 저장됨 (공유되지 않음)

---

## 로컬에서 열기 (테스트)

VSCode + **Live Server 확장** 설치 후:
- `index.html` 우클릭 → Open with Live Server

> Garland Tools API는 CORS 허용이므로 로컬에서도 검색 가능해요.

---

## 파일 구조

```
ff14-lookbook/
├── index.html   ← 메인
├── style.css    ← 스타일
└── app.js       ← 로직
```

이미지는 브라우저 localStorage에 base64로 저장되므로 별도 폴더 불필요.
