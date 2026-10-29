// 박스 사이즈 설정 (여기서 조절하세요!)
let BOX_WIDTH = 80;   // 박스 너비
let BOX_HEIGHT = 80;  // 박스 높이

// 레이아웃/이동 상수
const NUM_SIDE_BOXES = 11;  // Sentence 기본 좌우 박스 개수
const MAX_SIDE_BOXES = 60;  // Word 확장용 좌우 박스 최대 개수 (화면 채우기용)
const BOX_SPACING = 80;     // 박스 간 간격(px)
const SHIFT_PER_BOX = 40;   // 박스 당 텍스트 이동(px)
const MAX_DIAG = 6;         // Sentence 기본 대각선 범위
const MAX_DIAG_WORD = 60;   // Word 확장용 대각선 범위 (세로도 채우기)

let textInput; // 텍스트 입력창 (멀티라인)
let sizeSlider; // 텍스트 크기 슬라이더
let verticalShiftSlider; // 세로 확장 슬라이더
let yCompressionSlider; // Y축 압축 슬라이더
let rotationSlider; // 회전 각도 슬라이더
let speedSlider; // 애니메이션 속도 슬라이더
let movingSlider; // 움직임 진폭 슬라이더
let gridShiftXSlider; // 그리드 가로 이동량 슬라이더
let gridShiftYSlider; // 그리드 세로 이동량 슬라이더
let fileInput; // 파일 입력
let displayText = "A"; // 표시할 텍스트 (기본값 A)
let textSizeValue = 400; // 텍스트 크기 (기본값 400)
let verticalShiftValue = 0; // 세로 확장 값 (기본값 0)
let yCompressionValue = 0; // Y축 압축 값 (기본값 0)
let rotationValue = 0; // 회전 각도 값 (기본값 0)
let speedValue = 0; // 애니메이션 속도 값 (기본값 0)
let movingValue = 0; // 움직임 진폭 값 (기본값 0)
let gridShiftXValue = 40; // 그리드 가로 이동량 값 (기본값 40)
let gridShiftYValue = 40; // 그리드 세로 이동량 값 (기본값 40)
let uploadedImage = null; // 업로드된 이미지
let useImage = false; // 이미지 사용 여부

// 왼쪽 컨트롤바(슬라이더/입력 UI) 영역을 제외한 공간을 기준으로 중앙을 잡기
// - 캔버스는 전체 화면을 유지하되, 그리기 중심만 오른쪽으로 이동
const CONTROL_BAR_FALLBACK_WIDTH = 270; // 대략: x=20 + width=230 + 여백
const CONTROL_BAR_PADDING = 20;
let controlBarWidth = CONTROL_BAR_FALLBACK_WIDTH;

function updateControlBarWidth() {
  // p5 DOM 요소들은 대부분 absolute로 배치됨. 그중 왼쪽에 있는 것들의 최대 right를 컨트롤바 폭으로 사용.
  try {
    const elements = Array.from(document.body.querySelectorAll('*'));
    let maxRight = 0;

    for (const el of elements) {
      if (!el || el.tagName === 'CANVAS') continue;
      const style = window.getComputedStyle(el);
      if (style.position !== 'absolute' && style.position !== 'fixed') continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      // 왼쪽 컨트롤바 영역만 대상으로 제한 (우측/중앙에 다른 absolute 요소가 있어도 폭이 커지지 않게)
      if (rect.left > 200) continue;

      maxRight = Math.max(maxRight, rect.right);
    }

    if (maxRight > 0) {
      controlBarWidth = Math.ceil(maxRight + CONTROL_BAR_PADDING);
    } else {
      controlBarWidth = CONTROL_BAR_FALLBACK_WIDTH;
    }
  } catch (e) {
    controlBarWidth = CONTROL_BAR_FALLBACK_WIDTH;
  }
}

function getLayoutMetrics(virtualScale = 1) {
  const virtualW = width * virtualScale;
  const virtualH = height * virtualScale;

  // Word 모드는 scale(0.2)로 그리므로, 화면 픽셀 단위 UI 폭도 가상 좌표계에 맞게 확대
  const left = controlBarWidth * virtualScale;
  const contentW = Math.max(0, virtualW - left);

  return {
    virtualW,
    virtualH,
    left,
    contentW,
    centerX: left + contentW / 2,
    centerY: virtualH / 2,
  };
}

// 텍스트 렌더링 모드: 'sentence' = 기존 크게 가운데, 'word' = 작은 편집기 스타일
let textMode = 'sentence';
const WORD_SCALE_FACTOR = 0.2; // Sentence 대비 Word 모드 축소 비율(20%)

// 애니메이션을 위한 변수들
let timeOffset = 0; // 시간 오프셋

let buffers = []; // 재사용할 그래픽 버퍼들
let needsUpdate = true; // 텍스트/크기가 변경되었는지 확인
let glyphBuffer = null; // 텍스트를 미리 렌더링한 버퍼 (모든 박스에서 재사용)
let glyphAnchorX = 'center'; // 'center' | 'left' : 문자열이 어느 기준점에서 시작하는지
let boxCounter = 0; // 프레임 내 박스 라벨 번호
let wordModeBuffer = null; // Word 모드용 오프스크린 버퍼
let outlineFrame = null; // Vector drawing commands for the most recently displayed frame.

// 박스 외곽선과 번호 라벨을 그리는 헬퍼
function drawBoxOutlineAndLabel(x, y) {
  stroke(0);
  strokeWeight(0.5);
  noFill();
  rect(x, y, BOX_WIDTH, BOX_HEIGHT);
  // 라벨 텍스트 (작게)
  push();
  textFont('Helvetica');
  textStyle(NORMAL);
  textSize(11);
  textAlign(LEFT, TOP);
  // 흰색 스트로크 5px
  stroke(255);
  fill(0);
  text(String(++boxCounter), x + 3, y + 2);
  pop();
}

// 클리핑 후 glyphBuffer를 박스 내부에 그리는 헬퍼
function drawGlyphInBox(boxX, boxY, dx, extraX = 0, extraY = 0) {
  if (!glyphBuffer) return;
  
  // Word 모드면 가상 캔버스 크기 사용
  const virtualScale = (textMode === 'word') ? (1 / WORD_SCALE_FACTOR) : 1;
  const { virtualW, virtualH, centerX, centerY } = getLayoutMetrics(virtualScale);
  
  // 화면 바깥이면 스킵 (클리핑/드로우 비용 절감)
  if (boxX >= virtualW || boxX + BOX_WIDTH <= 0 || boxY >= virtualH || boxY + BOX_HEIGHT <= 0) {
    return;
  }

  // 현재 박스의 행/열 인덱스 계산 (중앙이 0)
  const centerBoxX = centerX - BOX_WIDTH / 2;
  const centerBoxY = centerY - BOX_HEIGHT / 2;
  const colIndex = Math.round((boxX - centerBoxX) / BOX_SPACING);
  const rowIndex = Math.round((boxY - centerBoxY) / BOX_SPACING);

  // 중앙으로부터의 거리 계산
  const distance = Math.sqrt(colIndex * colIndex + rowIndex * rowIndex);

  // 애니메이션 움직임 계산 (movingValue가 0이면 움직임 없음)
  let individualOffsetX = 0;
  let individualOffsetY = 0;

  if (movingValue > 0) {
    // 각 박스별로 고유한 ID 생성
    const boxId = (boxX * 0.01 + boxY * 0.01);

    // 다양한 패턴의 움직임 (강도는 movingValue에 비례)
    const pattern1X = sin(timeOffset * 0.005 + boxId * 2.3) * (movingValue * 1.2);
    const pattern1Y = cos(timeOffset * 0.007 + boxId * 1.7) * (movingValue * 0.9);

    const pattern2X = sin(timeOffset * 0.012 + boxId * 4.1) * (movingValue * 0.8);
    const pattern2Y = cos(timeOffset * 0.009 + boxId * 3.5) * (movingValue * 0.7);

    const pattern3X = sin(timeOffset * 0.003 + boxId * 1.1) * (movingValue * 0.6);
    const pattern3Y = cos(timeOffset * 0.004 + boxId * 0.9) * (movingValue * 0.5);

    const pattern4X = sin(timeOffset * 0.018 + boxId * 6.7) * (movingValue * 0.6);
    const pattern4Y = cos(timeOffset * 0.015 + boxId * 5.2) * (movingValue * 0.5);

    const pattern5X = sin(timeOffset * 0.008 + boxId * 3.9) * (movingValue * 0.7);
    const pattern5Y = cos(timeOffset * 0.011 + boxId * 4.8) * (movingValue * 0.6);

    const pattern6X = sin(timeOffset * 0.025 + boxId * 8.3) * (movingValue * 0.3);
    const pattern6Y = cos(timeOffset * 0.022 + boxId * 7.1) * (movingValue * 0.4);

    // 큰 폭의 느린 움직임
    const bigWaveX = sin(timeOffset * 0.002 + boxId * 1.5) * (movingValue * 1.5);
    const bigWaveY = cos(timeOffset * 0.0015 + boxId * 1.2) * (movingValue * 1.0);

    // 패턴들을 조합해서 복잡한 움직임 생성
    individualOffsetX = pattern1X + pattern2X + pattern3X + pattern4X + pattern5X + pattern6X + bigWaveX;
    individualOffsetY = pattern1Y + pattern2Y + pattern3Y + pattern4Y + pattern5Y + pattern6Y + bigWaveY;
  }

  // Vertical Shift: 행별 차등 세로 스케일링 (중앙이 가장 많이, 점차 약해짐)
  // rowIndex가 0에 가까울수록 더 많이 늘어남
  const maxStretch = Math.abs(verticalShiftValue) * 0.02; // 스케일링 강도 조절
  const distanceFromCenter = Math.abs(rowIndex);
  const stretchFactor = Math.max(0, maxStretch * (6 - distanceFromCenter) / 6); // 6행까지 점차 약해짐
  let scaleY = 1 + (verticalShiftValue > 0 ? stretchFactor : -stretchFactor);

  // Y축 압축 효과: 거리에 비례하여 Y축 스케일 감소
  if (yCompressionValue > 0) {
    const compressionFactor = 1 - (distance * yCompressionValue * 0.015);
    scaleY *= Math.max(0.1, compressionFactor); // 최소 0.1까지만 압축
  }

  // 회전 각도 효과: 거리에 비례하여 회전
  let rotationAngle = 0;
  if (rotationValue > 0 && distance > 0) {
    rotationAngle = distance * rotationValue * 0.8; // 거리에 비례한 회전
  }

  // glyph를 박스 안에 배치
  // - center: 기존처럼 glyphBuffer 중심이 박스 중심에 오도록
  // - left: glyphBuffer의 왼쪽 끝이 기준점(박스 중심 + dx)에 오도록
  let gx = boxX + (BOX_WIDTH / 2 + dx + extraX + individualOffsetX);
  if (glyphAnchorX === 'center') {
    gx -= glyphBuffer.width / 2;
  }
  const gy = boxY + (BOX_HEIGHT / 2 + extraY + individualOffsetY) - glyphBuffer.height / 2;

  // 캔버스 클리핑: 박스 영역에만 그리기
  push();
  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX, boxY, BOX_WIDTH, BOX_HEIGHT);
  ctx.clip();
  const exportClip = PatternExport.clipRect(ctx, pixelDensity(), boxX, boxY, BOX_WIDTH, BOX_HEIGHT);

  // 변환 적용 (회전 + 세로 스케일링)
  push();
  translate(boxX + BOX_WIDTH / 2, boxY + BOX_HEIGHT / 2); // 박스 중심으로 이동
  if (rotationAngle !== 0) {
    rotate(radians(rotationAngle)); // 회전 적용
  }
  scale(1, scaleY); // Y축 스케일링
  translate(-BOX_WIDTH / 2, -BOX_HEIGHT / 2); // 원래 위치로 복원
  image(glyphBuffer, gx - boxX, gy - boxY);
  PatternExport.captureImage(outlineFrame, ctx, pixelDensity(), glyphBuffer, gx - boxX, gy - boxY, exportClip);
  pop();

  ctx.restore();
  pop();
}

function setup() {
  createCanvas(windowWidth, windowHeight); // 윈도우 전체 크기

  // 슬라이더 커스텀 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    /* 슬라이더 트랙 (회색 -> 검은색) - 둘근고 굵게 */
    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      background: #000000;
      outline: none;
      height: 6px;  /* 4px에서 6px로 증가 */
      border-radius: 3px;  /* 1px에서 3px로 증가 */
    }
    
    /* 슬라이더 핸들 (동그란 원) - 1.5배 크기 */
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 13.5px;
      height: 13.5px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #000000;
      cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
      width: 13.5px;
      height: 13.5px;
      border-radius: 50%;
      background: #ffffff;
      border: 2px solid #000000;
      cursor: pointer;
    }
    
    /* 라벨 폰트를 모노스페이스 */
    p {
      font-family: 'Courier New', Courier, monospace !important;
      font-weight: 400 !important;
    }
  `;
  document.head.appendChild(style);

  // 텍스트 입력창 생성 (textarea로 변경해 엔터 줄바꿈 지원)
  textInput = createElement('textarea', 'A');
  textInput.position(20, 20);
  textInput.size(223, 72);
  textInput.attribute('rows', '4');
  textInput.style('font-size', '14px');
  textInput.style('box-sizing', 'border-box');
  textInput.style('padding', '8px 5px 8px 5px');
  textInput.style('line-height', '1.3');
  textInput.style('border', '1px solid #000000');
  textInput.style('resize', 'vertical');
  textInput.style('white-space', 'pre-wrap');

  // 텍스트 크기 슬라이더 생성
  sizeSlider = createSlider(10, 1500, 400, 10);
  sizeSlider.position(20, 140);  // 입력창 아래 10px 간격 (20 + 50 + 10 + 라벨 높이)
  sizeSlider.size(230);
  sizeSlider.style('width', '230px');

  // Grid Shift X 슬라이더 생성
  gridShiftXSlider = createSlider(0, 80, 40, 1); // 최소 0, 최대 80, 기본값 40, 단계 1
  gridShiftXSlider.position(20, 190);
  gridShiftXSlider.size(230);
  gridShiftXSlider.style('width', '230px');

  // Grid Shift Y 슬라이더 생성
  gridShiftYSlider = createSlider(0, 80, 40, 1); // 최소 0, 최대 80, 기본값 40, 단계 1
  gridShiftYSlider.position(20, 240);
  gridShiftYSlider.size(230);
  gridShiftYSlider.style('width', '230px');

  // 세로 확장 슬라이더 생성
  verticalShiftSlider = createSlider(-50, 50, 0, 1); // 최소 -50, 최대 50, 기본값 0, 단계 1
  verticalShiftSlider.position(20, 290);
  verticalShiftSlider.size(230);
  verticalShiftSlider.style('width', '230px');

  // Y축 압축 슬라이더 생성
  yCompressionSlider = createSlider(0, 100, 0, 1); // 최소 0, 최대 100, 기본값 0, 단계 1
  yCompressionSlider.position(20, 340);
  yCompressionSlider.size(230);
  yCompressionSlider.style('width', '230px');

  // 회전 각도 슬라이더 생성
  rotationSlider = createSlider(0, 50, 0, 1); // 최소 0, 최대 50, 기본값 0, 단계 1
  rotationSlider.position(20, 390);
  rotationSlider.size(230);
  rotationSlider.style('width', '230px');

  // Moving 슬라이더 생성
  movingSlider = createSlider(0, 100, 0, 1); // 최소 0, 최대 100, 기본값 0, 단계 1
  movingSlider.position(20, 440);
  movingSlider.size(230);
  movingSlider.style('width', '230px');

  // Speed 슬라이더 생성
  speedSlider = createSlider(0, 5, 0, 0.1); // 최소 0, 최대 5, 기본값 0, 단계 0.1
  speedSlider.position(20, 490);
  speedSlider.size(230);
  speedSlider.style('width', '230px');

  // Let the description set its natural height so neither text nor the final
  // line is clipped. The remaining footer elements follow it with small gaps.
  const footer = createDiv();
  footer.position(20, 620);
  footer.style('width', '234px');
  footer.style('display', 'flex');
  footer.style('flex-direction', 'column');
  footer.style('gap', '8px');

  // 점선
  let dividerLine = createDiv('');
  dividerLine.parent(footer);
  dividerLine.style('width', '233px');
  dividerLine.style('border-top', '2px dotted #000');
  dividerLine.style('margin', '8px 0');
  dividerLine.style('z-index', '1000');

    // 점선
  let dividerLine2 = createDiv('');
  dividerLine2.style('width', '233px');
  dividerLine2.style('border-top', '2px dotted #000');
  dividerLine2.style('margin', '8px 0');
  dividerLine2.style('z-index', '1000');

  // 설명글 추가
  let descriptionText = createP('This work approaches letterforms through the logic of the grid, observing how they shift when gaps appear or individual parts take on different shapes. It experiments with recombining these fragments to question where a letter ends and a graphic begins.');
  descriptionText.parent(footer);
  descriptionText.style('width', '233px');
  descriptionText.style('margin', '0');
  descriptionText.style('font-family', "'Courier New', Courier, monospace");
  descriptionText.style('font-size', '13.5px');
  descriptionText.style('font-weight', '400');
  descriptionText.style('color', '#000');
  descriptionText.style('line-height', '1.3');
  dividerLine2.parent(footer);

  // 저작권 문구 추가
  let copyrightText = createP('All right reserved Dongjun Choi @COPYRIGHT 2026');
  copyrightText.parent(footer);
  copyrightText.style('width', '233px');
  copyrightText.style('margin', '0');
  copyrightText.style('font-family', "'Courier New', Courier, monospace");
  copyrightText.style('font-size', '13.5px');
  copyrightText.style('font-weight', '400');
  copyrightText.style('color', '#000');
  copyrightText.style('line-height', '1.3');

  const instagramLink = createA('https://www.instagram.com/dongjun.obj/', '@dongjun.obj', '_blank');
  instagramLink.parent(footer);
  instagramLink.attribute('rel', 'noopener noreferrer');
  instagramLink.style('font-family', "'Courier New', Courier, monospace");
  instagramLink.style('font-size', '13.5px');
  instagramLink.style('line-height', '1.3');
  instagramLink.style('color', '#000000');

  const exportButton = createButton('Export');
  exportButton.parent(footer);
  // Match the Word / Sentence control's outer dimensions (230 + 4 by 30 + 4).
  exportButton.size(234, 34);
  exportButton.style('box-sizing', 'border-box');
  exportButton.style('border', '2px solid #000000');
  exportButton.style('border-radius', '20px');
  exportButton.style('background-color', '#ffffff');
  exportButton.style('color', '#000000');
  exportButton.style('font-family', "'Courier New', Courier, monospace");
  exportButton.style('font-size', '14px');
  exportButton.style('font-weight', '400');
  exportButton.style('display', 'flex');
  exportButton.style('align-items', 'center');
  exportButton.style('justify-content', 'center');
  exportButton.style('cursor', 'pointer');
  exportButton.style('flex-shrink', '0');
  exportButton.style('margin', '6px 0');
  exportButton.mousePressed(async () => {
    exportButton.attribute('disabled', '');
    exportButton.html('Exporting…');
    try {
      await PatternExport.exportCanvas(document.querySelector('canvas.p5Canvas'), {
        imageMode: useImage && Boolean(uploadedImage),
        width,
        height,
        scene: outlineFrame,
      });
    } catch (error) {
      console.error('Export failed:', error);
      window.alert(`Export failed: ${error.message}`);
    } finally {
      exportButton.removeAttribute('disabled');
      exportButton.html('Export');
    }
  });

  // 파일 입력 생성 (숨김 처리)
  fileInput = createFileInput(handleFile);
  fileInput.position(-1000, -1000);
  fileInput.style('display', 'none');
  fileInput.attribute('accept', 'image/*');

  // 텍스트/이미지 전환 토글 스위치 생성
  let toggleContainer = createDiv();
  toggleContainer.position(20, 575);
  toggleContainer.size(230, 30);
  toggleContainer.style('display', 'flex');
  toggleContainer.style('border', '2px solid #000000');
  toggleContainer.style('border-radius', '20px');
  toggleContainer.style('overflow', 'hidden');

  let textButton = createDiv('Text');
  textButton.parent(toggleContainer);
  textButton.style('flex', '1');
  textButton.style('display', 'flex');
  textButton.style('align-items', 'center');
  textButton.style('justify-content', 'center');
  textButton.style('font-family', "'Courier New', Courier, monospace");
  textButton.style('font-size', '14px');
  textButton.style('font-weight', '400');
  textButton.style('transition', 'all 0.3s');
  textButton.style('background-color', '#000000');
  textButton.style('color', '#ffffff');
  textButton.style('cursor', 'pointer');

  let imageButton = createDiv('Image');
  imageButton.parent(toggleContainer);
  imageButton.style('flex', '1');
  imageButton.style('display', 'flex');
  imageButton.style('align-items', 'center');
  imageButton.style('justify-content', 'center');
  imageButton.style('font-family', "'Courier New', Courier, monospace");
  imageButton.style('font-size', '14px');
  imageButton.style('font-weight', '400');
  imageButton.style('transition', 'all 0.3s');
  imageButton.style('background-color', '#ffffff');
  imageButton.style('color', '#000000');
  imageButton.style('cursor', 'pointer');

  // 워드/센텐스 전환 토글 스위치 생성 (Using Image/Text 위쪽)
  let modeToggleContainer = createDiv();
  modeToggleContainer.position(20, 530);
  modeToggleContainer.size(230, 30);
  modeToggleContainer.style('display', 'flex');
  modeToggleContainer.style('border', '2px solid #000000');
  modeToggleContainer.style('border-radius', '20px');
  modeToggleContainer.style('overflow', 'hidden');

  let sentenceButton = createDiv('Word');
  sentenceButton.parent(modeToggleContainer);
  sentenceButton.style('flex', '1');
  sentenceButton.style('display', 'flex');
  sentenceButton.style('align-items', 'center');
  sentenceButton.style('justify-content', 'center');
  sentenceButton.style('font-family', "'Courier New', Courier, monospace");
  sentenceButton.style('font-size', '14px');
  sentenceButton.style('font-weight', '400');
  sentenceButton.style('transition', 'all 0.3s');
  sentenceButton.style('background-color', '#000000');
  sentenceButton.style('color', '#ffffff');
  sentenceButton.style('cursor', 'pointer');

  let wordButton = createDiv('Sentence');
  wordButton.parent(modeToggleContainer);
  wordButton.style('flex', '1');
  wordButton.style('display', 'flex');
  wordButton.style('align-items', 'center');
  wordButton.style('justify-content', 'center');
  wordButton.style('font-family', "'Courier New', Courier, monospace");
  wordButton.style('font-size', '14px');
  wordButton.style('font-weight', '400');
  wordButton.style('transition', 'all 0.3s');
  wordButton.style('background-color', '#ffffff');
  wordButton.style('color', '#000000');
  wordButton.style('cursor', 'pointer');

  // 토글 상태 업데이트 함수를 전역 변수로 선언
  window.updateToggleState = function() {
    if (useImage) {
      imageButton.style('background-color', '#000000');
      imageButton.style('color', '#ffffff');
      textButton.style('background-color', '#ffffff');
      textButton.style('color', '#000000');
    } else {
      imageButton.style('background-color', '#ffffff');
      imageButton.style('color', '#000000');
      textButton.style('background-color', '#000000');
      textButton.style('color', '#ffffff');
    }
  }

  // 워드/센텐스 토글 상태 업데이트 함수
  window.updateModeToggleState = function() {
    if (textMode === 'sentence') {
      sentenceButton.style('background-color', '#000000');
      sentenceButton.style('color', '#ffffff');
      wordButton.style('background-color', '#ffffff');
      wordButton.style('color', '#000000');
    } else {
      sentenceButton.style('background-color', '#ffffff');
      sentenceButton.style('color', '#000000');
      wordButton.style('background-color', '#000000');
      wordButton.style('color', '#ffffff');
    }
  }

  // Using Image 클릭 시 파일 선택 열기
  imageButton.mousePressed(() => {
    fileInput.elt.click();
  });

  // Text 클릭 시 텍스트 모드로 전환
  textButton.mousePressed(() => {
    useImage = false;
    window.updateToggleState();
    needsUpdate = true;
  });

  // Word 모드 클릭: 작은 텍스트 편집기 스타일
  // Word 버튼 클릭: sentenceButton은 'Word'라는 텍스트를 표시함
  sentenceButton.mousePressed(() => {
    textMode = 'sentence';
    if (window.updateModeToggleState) {
      window.updateModeToggleState();
    }
    needsUpdate = true;
  });

  // Sentence 버튼 클릭: wordButton은 'Sentence'라는 텍스트를 표시함
  wordButton.mousePressed(() => {
    textMode = 'word';
    // 워드 모드에서는 텍스트 기반으로만 사용
    useImage = false;
    needsUpdate = true; // 즉시 렌더링 업데이트
    if (window.updateToggleState) {
      window.updateToggleState();
    }
    if (window.updateModeToggleState) {
      window.updateModeToggleState();
    }
  });

  // 슬라이더 라벨들 추가
  let sizeLabel = createP('Size');
  sizeLabel.position(20, 115);
  sizeLabel.style('margin', '0');
  sizeLabel.style('font-size', '16px');
  sizeLabel.style('color', '#000');

  let gridShiftXLabel = createP('Grid Shift X');
  gridShiftXLabel.position(20, 165);
  gridShiftXLabel.style('margin', '0');
  gridShiftXLabel.style('font-size', '16px');
  gridShiftXLabel.style('color', '#000');

  let gridShiftYLabel = createP('Grid Shift Y');
  gridShiftYLabel.position(20, 215);
  gridShiftYLabel.style('margin', '0');
  gridShiftYLabel.style('font-size', '16px');
  gridShiftYLabel.style('color', '#000');

  let verticalLabel = createP('Squeeze');
  verticalLabel.position(20, 265);
  verticalLabel.style('margin', '0');
  verticalLabel.style('font-size', '16px');
  verticalLabel.style('color', '#000');

  let yCompressionLabel = createP('Compression Y');
  yCompressionLabel.position(20, 315);
  yCompressionLabel.style('margin', '0');
  yCompressionLabel.style('font-size', '16px');
  yCompressionLabel.style('color', '#000');

  let rotationLabel = createP('Rotation');
  rotationLabel.position(20, 365);
  rotationLabel.style('margin', '0');
  rotationLabel.style('font-size', '16px');
  rotationLabel.style('color', '#000');

  let movingLabel = createP('Random Motion');
  movingLabel.position(20, 415);
  movingLabel.style('margin', '0');
  movingLabel.style('font-size', '16px');
  movingLabel.style('color', '#000');

  let speedLabel = createP('Speed');
  speedLabel.position(20, 465);
  speedLabel.style('margin', '0');
  speedLabel.style('font-size', '16px');
  speedLabel.style('color', '#000');



  // 입력값이 변경될 때마다 호출되는 함수
  textInput.input(() => {
    displayText = textInput.value() || "A"; // 빈 값이면 A로 기본값
    needsUpdate = true; // 업데이트 필요 표시
  });

  // 슬라이더 값이 변경될 때마다 호출되는 함수들
  sizeSlider.input(() => {
    textSizeValue = sizeSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  verticalShiftSlider.input(() => {
    verticalShiftValue = verticalShiftSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  yCompressionSlider.input(() => {
    yCompressionValue = yCompressionSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  rotationSlider.input(() => {
    rotationValue = rotationSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  speedSlider.input(() => {
    speedValue = speedSlider.value();
  });

  movingSlider.input(() => {
    movingValue = movingSlider.value();
  });

  gridShiftXSlider.input(() => {
    gridShiftXValue = gridShiftXSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  gridShiftYSlider.input(() => {
    gridShiftYValue = gridShiftYSlider.value();
    needsUpdate = true; // 업데이트 필요 표시
  });

  // 그래픽 버퍼들 미리 생성 (MAX_SIDE_BOXES 기준으로 Word 모드도 커버)
  const totalBoxes = MAX_SIDE_BOXES * 2 + 1;
  for (let i = 0; i < totalBoxes; i++) {
    buffers[i] = createGraphics(BOX_WIDTH, BOX_HEIGHT);
  }

  // UI 생성이 끝난 뒤 컨트롤바 폭 측정
  updateControlBarWidth();
  // 브라우저가 레이아웃을 확정한 뒤 한 번 더 (폰트/스타일 적용 타이밍 대비)
  setTimeout(updateControlBarWidth, 0);
}

// 파일 업로드 처리 함수
function handleFile(file) {
  console.log('파일 업로드됨:', file);
  if (file.type === 'image') {
    uploadedImage = loadImage(file.data, () => {
      useImage = true;
      needsUpdate = true;
      console.log('이미지 로드 완료');
      // 토글 스위치 상태 업데이트
      if (window.updateToggleState) {
        window.updateToggleState();
      }
    });
  } else {
    console.log('이미지 파일만 업로드 가능합니다.');
  }
}

function draw() {
  outlineFrame = [];
  background(255); // 흰색 배경

  // Word 모드: 0.2배로 축소해서 그리기
  if (textMode === 'word') {
    push();
    scale(WORD_SCALE_FACTOR);
  }

  // 시간 증가 (애니메이션용)
  timeOffset += speedValue;

  // Word 모드: 가상 캔버스가 5배 크므로 좌표도 5배
  const virtualScale = (textMode === 'word') ? (1 / WORD_SCALE_FACTOR) : 1;
  const { centerX, centerY } = getLayoutMetrics(virtualScale);
  const boxY = centerY - BOX_HEIGHT / 2;

  // 렌더 범위: Word 모드면 확장, Sentence 모드면 기본
  const sideBoxes = (textMode === 'word') ? MAX_SIDE_BOXES : NUM_SIDE_BOXES;
  const maxDiag = (textMode === 'word') ? MAX_DIAG_WORD : MAX_DIAG;
  boxCounter = 0; // 프레임마다 라벨 번호 초기화

  // 텍스트나 크기가 변경되었을 때만 버퍼 업데이트
  if (needsUpdate) {
    let bufferIndex = 0;
    for (let i = -sideBoxes; i <= sideBoxes; i++) {
      const dx = -i * gridShiftXValue; // 그리드 가로 이동량 슬라이더로 조절
      const pg = buffers[bufferIndex];
      pg.outlineRuns = null;
      pg.outlineOpaque = true;

      pg.clear(); // 이전 내용 지우기
      pg.background(255);

      pg.push();
      pg.translate(BOX_WIDTH / 2, BOX_HEIGHT / 2); // 중심으로 이동

      if (useImage && uploadedImage) {
        // 이미지 사용
        const imgSize = textSizeValue * 0.8; // 텍스트 크기에 비례한 이미지 크기
        const imgW = imgSize;
        const imgH = imgSize * (uploadedImage.height / uploadedImage.width); // 비율 유지
        pg.image(uploadedImage, dx - imgW / 2, -imgH / 2, imgW, imgH);
      } else {
        // 텍스트 사용 - Sentence 기준 중앙 정렬만 사용
        pg.textFont('Helvetica');
        pg.textStyle(BOLD);
        pg.textAlign(CENTER, CENTER);
        pg.fill(0);
        pg.textSize(textSizeValue);
        PatternExport.captureText(pg, () => pg.text(displayText, dx, 0));
      }
      pg.pop();

      bufferIndex++;
    }

    // glyphBuffer(텍스트/이미지 단일 이미지) 업데이트
    let tw, th;
    let computedLeading = 0;
    if (useImage && uploadedImage) {
      // 이미지 사용시 크기 계산
      const imgSize = textSizeValue * 0.8;
      tw = Math.ceil(imgSize) + 20;
      th = Math.ceil(imgSize * (uploadedImage.height / uploadedImage.width)) + 20;
    } else {
      // 텍스트 사용시 크기 계산
      textFont('Helvetica');
      textStyle(BOLD);
      textSize(textSizeValue);
      const lines = (displayText || 'A').split('\n');
      const baseLineHeight = textAscent() + textDescent();
      computedLeading = baseLineHeight * 1.15;
      tw = max(1, Math.ceil(lines.reduce((m, line) => Math.max(m, textWidth(line)), 1)));
      const totalHeight = baseLineHeight + computedLeading * (lines.length - 1);
      th = Math.ceil(totalHeight) + 20;
    }
    glyphBuffer = createGraphics(tw + 20, th);
    glyphBuffer.clear();

    glyphBuffer.push();
    glyphBuffer.translate(glyphBuffer.width / 2, glyphBuffer.height / 2);

    if (useImage && uploadedImage) {
      // 이미지 사용
      const imgSize = textSizeValue * 0.8; // 텍스트 크기에 비례한 이미지 크기
      const imgW = imgSize;
      const imgH = imgSize * (uploadedImage.height / uploadedImage.width); // 비율 유지
      glyphBuffer.image(uploadedImage, -imgW / 2, -imgH / 2, imgW, imgH);
    } else {
      // 텍스트 사용
      glyphBuffer.textFont('Helvetica');
      glyphBuffer.textStyle(BOLD);
      glyphBuffer.textAlign(CENTER, CENTER); // Sentence와 동일한 중앙 정렬
      glyphBuffer.fill(0);
      glyphBuffer.textSize(textSizeValue);
      PatternExport.captureText(glyphBuffer, () => glyphBuffer.text(displayText, 0, 0));
    }
    glyphBuffer.pop();

    // drawGlyphInBox에서 x 기준점을 어떻게 잡을지 설정
    // Sentence와 동일하게 중앙 정렬 기준 사용
    glyphAnchorX = 'center';
    needsUpdate = false; // 업데이트 완료
  }

  // 기존 박스 위치를 기준으로 전체 격자에 박스들 그리기 (고정 크기)
  const centerBoxX = centerX - BOX_WIDTH / 2; // 중앙 박스의 X 위치
  const centerBoxY = boxY; // 중앙 박스의 Y 위치

  // 고정된 격자 범위 (윈도우 크기와 무관)
  const leftCols = 15;  // 고정값
  const rightCols = 15; // 고정값
  const topRows = 10;   // 고정값
  const bottomRows = 10; // 고정값

  // 특정 박스 번호 범위만 그리기
  function shouldDrawBox(boxNumber) {
    // 161~181, 192~212, 223~243, 254~274, 285~305, 316~336, 347~367, 378~398, 409~429, 440~460, 471~491, 502~522
    const ranges = [
      [161, 181], [192, 212], [223, 243], [254, 274], [285, 305],
      [316, 336], [347, 367], [378, 398], [409, 429], [440, 460],
      [471, 491], [502, 522]
    ];

    return ranges.some(([start, end]) => boxNumber >= start && boxNumber <= end);
  }

  // 격자 테두리는 마지막 오버레이 단계에서 한 번에 그린다.
  for (let row = -10; row <= 10; row++) {
    for (let col = -15; col <= 15; col++) {
      const currentBoxX = centerBoxX + col * BOX_SPACING;
      const currentBoxY = centerBoxY + row * BOX_SPACING;

      // 박스 번호 계산
      const boxNumber = (row + 10) * 31 + (col + 15) + 1;

      // 박스 테두리 오버레이에서 처리
    }
  }

  // Word 모드: 모든 격자 위치에 직접 그리기 (깨짐 방지)
  if (textMode === 'word') {
    for (let row = -maxDiag; row <= maxDiag; row++) {
      for (let col = -sideBoxes; col <= sideBoxes; col++) {
        const bx = centerX - BOX_WIDTH / 2 + col * BOX_SPACING;
        const by = centerY - BOX_HEIGHT / 2 + row * BOX_SPACING;
        const dx = -col * gridShiftXValue;
        const extraX = 0;           // dx에 이미 열 오프셋 포함
        const extraY = -row * gridShiftYValue;   // 행에 따른 Y 오프셋 (gridShiftYValue 사용)
        drawGlyphInBox(bx, by, dx, extraX, extraY);
      }
    }
  } else {
    // Sentence 모드: 기존 대각선 복사 방식
    // 미리 생성된 버퍼들을 화면에 그리기만 함 (텍스트가 있는 박스들)
    let bufferIndex = 0;
    for (let i = -sideBoxes; i <= sideBoxes; i++) {
      const boxX = centerX - BOX_WIDTH / 2 + i * BOX_SPACING; // 박스 위치
      const dx = -i * gridShiftXValue; // 해당 열의 기본 텍스트 이동 (gridShiftXValue 사용)

      // 중앙 행 (rowIndex = 0)에 세로 스케일링 적용 - 가장 많이 늘어남
      const maxStretch = Math.abs(verticalShiftValue) * 0.02;
      const scaleY = 1 + (verticalShiftValue > 0 ? maxStretch : -maxStretch);

      push();
      translate(boxX + BOX_WIDTH / 2, boxY + BOX_HEIGHT / 2); // 박스 중심으로 이동
      scale(1, scaleY); // Y축만 스케일링
      translate(-BOX_WIDTH / 2, -BOX_HEIGHT / 2); // 원래 위치로 복원
      image(buffers[bufferIndex], 0, 0);
      PatternExport.captureImage(outlineFrame, drawingContext, pixelDensity(), buffers[bufferIndex], 0, 0);
      pop();

      // 가운데 박스(i===0)의 수직 복사들: 위로(+diag), 아래로(-diag)
      if (i === 0) {
        for (let diag = 1; diag <= maxDiag; diag++) {
          // 위쪽: 박스는 -80*diag, 텍스트는 +gridShiftYValue*diag
          const upY = boxY - 80 * diag;
          drawGlyphInBox(boxX, upY, dx, 0, gridShiftYValue * diag);

          // 아래쪽: 박스는 +80*diag, 텍스트는 -gridShiftYValue*diag
          const downY = boxY + 80 * diag;
          drawGlyphInBox(boxX, downY, dx, 0, -gridShiftYValue * diag);
        }
      }

      // 오른쪽 박스들: 대각선 복사 (i >= 1)
      if (i >= 1 && i <= sideBoxes) {
        for (let diag = 1; diag <= maxDiag; diag++) {
          // 오른쪽 위 대각선: 박스 +80*diag, -80*diag / 텍스트 -gridShiftXValue*diag, +gridShiftYValue*diag
          drawGlyphInBox(boxX + 80 * diag, boxY - 80 * diag, dx, -gridShiftXValue * diag, gridShiftYValue * diag);

          // 오른쪽 아래 대각선: 박스 +80*diag, +80*diag / 텍스트 -gridShiftXValue*diag, -gridShiftYValue*diag
          drawGlyphInBox(boxX + 80 * diag, boxY + 80 * diag, dx, -gridShiftXValue * diag, -gridShiftYValue * diag);
        }
      }

      // 왼쪽 박스들: 대각선 복사 (i <= -1)
      if (i <= -1 && i >= -sideBoxes) {
        for (let diag = 1; diag <= maxDiag; diag++) {
          // 왼쪽 위 대각선: 박스 -80*diag, -80*diag / 텍스트 +gridShiftXValue*diag, +gridShiftYValue*diag
          drawGlyphInBox(boxX - 80 * diag, boxY - 80 * diag, dx, gridShiftXValue * diag, gridShiftYValue * diag);

          // 왼쪽 아래 대각선: 박스 -80*diag, +80*diag / 텍스트 +gridShiftXValue*diag, -gridShiftYValue*diag
          drawGlyphInBox(boxX - 80 * diag, boxY + 80 * diag, dx, gridShiftXValue * diag, -gridShiftYValue * diag);
        }
      }

      bufferIndex++;
    }
  }

  // 모든 박스 번호를 최상위 레이어에 다시 그리기 (모든 텍스트 위에 표시)
  boxCounter = 0; // 번호 카운터 다시 초기화

  // 격자의 모든 박스 번호를 다시 그리기 (고정 크기)
  const labelCenterX = centerX - BOX_WIDTH / 2;
  const labelCenterY = boxY;
  const labelLeftCols = 15;  // 고정값
  const labelRightCols = 15; // 고정값
  const labelTopRows = 10;   // 고정값
  const labelBottomRows = 10; // 고정값

  // 고정된 31x21 격자로 번호 그리기 (특정 범위만)
  for (let row = -10; row <= 10; row++) {
    for (let col = -15; col <= 15; col++) {
      const currentBoxX = labelCenterX + col * BOX_SPACING;
      const currentBoxY = labelCenterY + row * BOX_SPACING;

      // 고정된 번호 계산 (윈도우 크기와 무관)
      const boxNumber = (row + 10) * 31 + (col + 15) + 1;

      // 박스 번호는 표시하지 않음 (숨김)
    }
  }

  // 특별 복사: 모든 모드에서 실행 (Word도 동일한 결과 필요)
  // 박스 번호에 해당하는 위치 찾기 함수 (완전 고정)
  function getBoxPosition(boxNumber) {
    // 고정된 31x21 격자에서 번호 계산 (윈도우 크기 무관)
    const totalCols = 31; // -15 to +15
    const totalRows = 21; // -10 to +10

    // 번호는 1부터 시작, 0-based로 변환
    const index = boxNumber - 1;
    const row = Math.floor(index / totalCols) - 10; // -10 to +10
    const col = (index % totalCols) - 15; // -15 to +15

    const boxX = labelCenterX + col * BOX_SPACING;
    const boxY = labelCenterY + row * BOX_SPACING;

    return { x: boxX, y: boxY, col: col, row: row };
  }

  // (row, col) -> boxNumber (유효 범위 밖이면 null)
  function rowColToBoxNumber(row, col) {
    if (row < -10 || row > 10 || col < -15 || col > 15) return null;
    const totalCols = 31;
    return (row + 10) * totalCols + (col + 15) + 1;
  }

  // 주어진 (row, col)의 박스가 일반 렌더링 루프에서 어떤 설정으로 그려졌는지 계산
  // 동일한 형태로 다른 위치에 복사할 때 사용
  function getGlyphConfigForBox(row, col) {
    const diag = Math.abs(row);
    // 중앙 행: 버퍼 이미지가 그려짐. 동일 형태를 위해서는 dx만 적용, 추가 오프셋은 없음
    if (row === 0) {
      return { dx: -col * gridShiftXValue, extraX: 0, extraY: 0 };
    }
    // 중앙 열에서 수직 대칭 복사된 경우
    if (col === 0) {
      return { dx: 0, extraX: 0, extraY: -gridShiftYValue * row }; // row<0면 +, row>0면 -
    }
    // 오른쪽 영역에서 대각선 복사된 경우
    if (col > 0) {
      const i = col - diag; // 소스 열
      const extraX = -gridShiftXValue * diag;
      const extraY = row < 0 ? gridShiftYValue * diag : -gridShiftYValue * diag;
      return { dx: -i * gridShiftXValue, extraX, extraY };
    }
    // 왼쪽 영역에서 대각선 복사된 경우 (col < 0)
    {
      const i = col + diag; // 소스 열(음수)
      const extraX = gridShiftXValue * diag;
      const extraY = row < 0 ? gridShiftYValue * diag : -gridShiftYValue * diag;
      return { dx: -i * gridShiftXValue, extraX, extraY };
    }
  }

  // 타겟 박스 번호의 왼쪽 위(-1 col, -1 row)에서 복사하여
  // 텍스트만 왼쪽 위로 gridShiftX/Y 값만큼 이동해 그리는 헬퍼
  function copyFromTopLeftShift(targetNumber, deltaX = null, deltaY = null) {
    if (deltaX === null) deltaX = gridShiftXValue; // 기본값으로 gridShiftXValue 사용
    if (deltaY === null) deltaY = gridShiftYValue; // 기본값으로 gridShiftYValue 사용
    const sourceNumber = targetNumber - 32; // 위로 한 행(31) + 왼쪽 한 칸(1)
    const src = getBoxPosition(sourceNumber);
    const dst = getBoxPosition(targetNumber);
    if (!src || !dst) return;
    const cfg = getGlyphConfigForBox(src.row, src.col);
    drawGlyphInBox(dst.x, dst.y, cfg.dx, cfg.extraX - deltaX, cfg.extraY - deltaY);
  }

  // 일반화: 임의의 소스/타겟 박스 번호와 텍스트 델타로 복사
  function drawCopy(srcNumber, dstNumber, deltaX = 0, deltaY = 0) {
    const src = getBoxPosition(srcNumber);
    const dst = getBoxPosition(dstNumber);
    if (!src || !dst) return;
    const cfg = getGlyphConfigForBox(src.row, src.col);
    drawGlyphInBox(dst.x, dst.y, cfg.dx, cfg.extraX + deltaX, cfg.extraY + deltaY);
  }

  // 규칙 배열로 일괄 적용
  function applyCopyRules(rules) {
    for (const r of rules) {
      drawCopy(r.src, r.dst, r.dx || 0, r.dy || 0);
    }
  }

  // 타겟 박스 번호의 오른쪽 위(+1 col, -1 row)에서 복사하여
  // 텍스트만 오른쪽 위로 gridShiftX/Y 값만큼 이동해 그리는 헬퍼
  function copyFromTopRightShift(targetNumber, deltaX = null, deltaY = null) {
    if (deltaX === null) deltaX = gridShiftXValue; // 기본값으로 gridShiftXValue 사용
    if (deltaY === null) deltaY = gridShiftYValue; // 기본값으로 gridShiftYValue 사용
    const sourceNumber = targetNumber - 30; // 위로 한 행(31) + 오른쪽 한 칸(-1 + 1 = -30)
    const src = getBoxPosition(sourceNumber);
    const dst = getBoxPosition(targetNumber);
    if (!src || !dst) return;
    const cfg = getGlyphConfigForBox(src.row, src.col);
    drawGlyphInBox(dst.x, dst.y, cfg.dx, cfg.extraX + deltaX, cfg.extraY - deltaY);
  }

  // 72번 → 62번 복사
  const box72 = getBoxPosition(72);
  const box62 = getBoxPosition(62);
  if (box72 && box62) {
    const dx72 = -box72.col * gridShiftXValue;
    drawGlyphInBox(box62.x, box62.y, dx72, -gridShiftXValue, gridShiftYValue);
  }

  // 61번 → 51번 복사
  const box61 = getBoxPosition(61);
  const box51 = getBoxPosition(51);
  if (box61 && box51) {
    const dx61 = -box61.col * gridShiftXValue;
    drawGlyphInBox(box51.x, box51.y, dx61, -gridShiftXValue, gridShiftYValue);
  }

  // 326번 → 294번 복사
  const box326_294 = getBoxPosition(326);
  const box294 = getBoxPosition(294);
  if (box326_294 && box294) {
    const cfg326_294 = getGlyphConfigForBox(box326_294.row, box326_294.col);
    drawGlyphInBox(box294.x, box294.y, cfg326_294.dx, cfg326_294.extraX + gridShiftXValue, cfg326_294.extraY + gridShiftYValue);
  }

  // 294번 → 262번 복사 (우측아래에서 복사)
  const box294_262 = getBoxPosition(294);
  const box262 = getBoxPosition(262);
  if (box294_262 && box262) {
    const cfg294_262 = getGlyphConfigForBox(box294_262.row, box294_262.col);
    drawGlyphInBox(box262.x, box262.y, cfg294_262.dx, cfg294_262.extraX + gridShiftXValue, cfg294_262.extraY + gridShiftYValue);
  }

  // 295번 → 263번 복사
  const box295_263 = getBoxPosition(295);
  const box263 = getBoxPosition(263);
  if (box295_263 && box263) {
    const cfg295_263 = getGlyphConfigForBox(box295_263.row, box295_263.col);
    drawGlyphInBox(box263.x, box263.y, cfg295_263.dx, cfg295_263.extraX + gridShiftXValue, cfg295_263.extraY + gridShiftYValue);
  }

  // 262번 → 230번 복사
  const box262_230 = getBoxPosition(262);
  const box230 = getBoxPosition(230);
  if (box262_230 && box230) {
    const cfg262_230 = getGlyphConfigForBox(box262_230.row, box262_230.col);
    drawGlyphInBox(box230.x, box230.y, cfg262_230.dx, cfg262_230.extraX + gridShiftXValue, cfg262_230.extraY + gridShiftYValue);
  }

  // 263번 → 231번 복사
  const box263_231 = getBoxPosition(263);
  const box231 = getBoxPosition(231);
  if (box263_231 && box231) {
    const cfg263_231 = getGlyphConfigForBox(box263_231.row, box263_231.col);
    drawGlyphInBox(box231.x, box231.y, cfg263_231.dx, cfg263_231.extraX + gridShiftXValue, cfg263_231.extraY + gridShiftYValue);
  }

  // 264번 → 232번 복사
  const box264_232 = getBoxPosition(264);
  const box232 = getBoxPosition(232);
  if (box264_232 && box232) {
    const cfg264_232 = getGlyphConfigForBox(box264_232.row, box264_232.col);
    drawGlyphInBox(box232.x, box232.y, cfg264_232.dx, cfg264_232.extraX + gridShiftXValue, cfg264_232.extraY + gridShiftYValue);
  }

  // 230번 → 198번 복사
  const box230_198 = getBoxPosition(230);
  const box198 = getBoxPosition(198);
  if (box230_198 && box198) {
    const cfg230_198 = getGlyphConfigForBox(box230_198.row, box230_198.col);
    drawGlyphInBox(box198.x, box198.y, cfg230_198.dx, cfg230_198.extraX + gridShiftXValue, cfg230_198.extraY + gridShiftYValue);
  }

  // 231번 → 199번 복사
  const box231_199 = getBoxPosition(231);
  const box199 = getBoxPosition(199);
  if (box231_199 && box199) {
    const cfg231_199 = getGlyphConfigForBox(box231_199.row, box231_199.col);
    drawGlyphInBox(box199.x, box199.y, cfg231_199.dx, cfg231_199.extraX + gridShiftXValue, cfg231_199.extraY + gridShiftYValue);
  }

  // 232번 → 200번 복사
  const box232_200 = getBoxPosition(232);
  const box200 = getBoxPosition(200);
  if (box232_200 && box200) {
    const cfg232_200 = getGlyphConfigForBox(box232_200.row, box232_200.col);
    drawGlyphInBox(box200.x, box200.y, cfg232_200.dx, cfg232_200.extraX + gridShiftXValue, cfg232_200.extraY + gridShiftYValue);
  }

  // 233번 → 201번 복사
  const box233_201 = getBoxPosition(233);
  const box201 = getBoxPosition(201);
  if (box233_201 && box201) {
    const cfg233_201 = getGlyphConfigForBox(box233_201.row, box233_201.col);
    drawGlyphInBox(box201.x, box201.y, cfg233_201.dx, cfg233_201.extraX + gridShiftXValue, cfg233_201.extraY + gridShiftYValue);
  }

  // 198번 → 166번 복사
  const box198_166 = getBoxPosition(198);
  const box166 = getBoxPosition(166);
  if (box198_166 && box166) {
    const cfg198_166 = getGlyphConfigForBox(box198_166.row, box198_166.col);
    drawGlyphInBox(box166.x, box166.y, cfg198_166.dx, cfg198_166.extraX + gridShiftXValue, cfg198_166.extraY + gridShiftYValue);
  }

  // 199번 → 167번 복사
  const box199_167 = getBoxPosition(199);
  const box167 = getBoxPosition(167);
  if (box199_167 && box167) {
    const cfg199_167 = getGlyphConfigForBox(box199_167.row, box199_167.col);
    drawGlyphInBox(box167.x, box167.y, cfg199_167.dx, cfg199_167.extraX + gridShiftXValue, cfg199_167.extraY + gridShiftYValue);
  }

  // 200번 → 168번 복사
  const box200_168 = getBoxPosition(200);
  const box168 = getBoxPosition(168);
  if (box200_168 && box168) {
    const cfg200_168 = getGlyphConfigForBox(box200_168.row, box200_168.col);
    drawGlyphInBox(box168.x, box168.y, cfg200_168.dx, cfg200_168.extraX + gridShiftXValue, cfg200_168.extraY + gridShiftYValue);
  }

  // 201번 → 169번 복사
  const box201_169 = getBoxPosition(201);
  const box169 = getBoxPosition(169);
  if (box201_169 && box169) {
    const cfg201_169 = getGlyphConfigForBox(box201_169.row, box201_169.col);
    drawGlyphInBox(box169.x, box169.y, cfg201_169.dx, cfg201_169.extraX + gridShiftXValue, cfg201_169.extraY + gridShiftYValue);
  }

  // 202번 → 170번 복사
  const box202_170 = getBoxPosition(202);
  const box170 = getBoxPosition(170);
  if (box202_170 && box170) {
    const cfg202_170 = getGlyphConfigForBox(box202_170.row, box202_170.col);
    drawGlyphInBox(box170.x, box170.y, cfg202_170.dx, cfg202_170.extraX + gridShiftXValue, cfg202_170.extraY + gridShiftYValue);
  }

  // 166번 → 134번 복사
  const box166_134 = getBoxPosition(166);
  const box134 = getBoxPosition(134);
  if (box166_134 && box134) {
    const cfg166_134 = getGlyphConfigForBox(box166_134.row, box166_134.col);
    drawGlyphInBox(box134.x, box134.y, cfg166_134.dx, cfg166_134.extraX + gridShiftXValue, cfg166_134.extraY + gridShiftYValue);
  }

  // 167번 → 135번 복사
  const box167_135 = getBoxPosition(167);
  const box135 = getBoxPosition(135);
  if (box167_135 && box135) {
    const cfg167_135 = getGlyphConfigForBox(box167_135.row, box167_135.col);
    drawGlyphInBox(box135.x, box135.y, cfg167_135.dx, cfg167_135.extraX + gridShiftXValue, cfg167_135.extraY + gridShiftYValue);
  }

  // 168번 → 136번 복사
  const box168_136 = getBoxPosition(168);
  const box136 = getBoxPosition(136);
  if (box168_136 && box136) {
    const cfg168_136 = getGlyphConfigForBox(box168_136.row, box168_136.col);
    drawGlyphInBox(box136.x, box136.y, cfg168_136.dx, cfg168_136.extraX + gridShiftXValue, cfg168_136.extraY + gridShiftYValue);
  }

  // 169번 → 137번 복사
  const box169_137 = getBoxPosition(169);
  const box137 = getBoxPosition(137);
  if (box169_137 && box137) {
    const cfg169_137 = getGlyphConfigForBox(box169_137.row, box169_137.col);
    drawGlyphInBox(box137.x, box137.y, cfg169_137.dx, cfg169_137.extraX + gridShiftXValue, cfg169_137.extraY + gridShiftYValue);
  }

  // 170번 → 138번 복사
  const box170_138 = getBoxPosition(170);
  const box138 = getBoxPosition(138);
  if (box170_138 && box138) {
    const cfg170_138 = getGlyphConfigForBox(box170_138.row, box170_138.col);
    drawGlyphInBox(box138.x, box138.y, cfg170_138.dx, cfg170_138.extraX + gridShiftXValue, cfg170_138.extraY + gridShiftYValue);
  }

  // 171번 → 139번 복사
  const box171_139 = getBoxPosition(171);
  const box139 = getBoxPosition(139);
  if (box171_139 && box139) {
    const cfg171_139 = getGlyphConfigForBox(box171_139.row, box171_139.col);
    drawGlyphInBox(box139.x, box139.y, cfg171_139.dx, cfg171_139.extraX + gridShiftXValue, cfg171_139.extraY + gridShiftYValue);
  }

  // 커스텀 복사 규칙(기존 수동 블록들을 선언형으로 정리)
  applyCopyRules([
    { src: 326, dst: 296, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 326, dst: 358, dx: -gridShiftXValue, dy: -gridShiftYValue },
    { src: 295, dst: 265, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 233, dst: 203, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 202, dst: 172, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 171, dst: 141, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 296, dst: 266, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 265, dst: 235, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 234, dst: 204, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 203, dst: 173, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 172, dst: 142, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 173, dst: 143, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 174, dst: 144, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 175, dst: 145, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 204, dst: 174, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 205, dst: 175, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 206, dst: 176, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 235, dst: 205, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 236, dst: 206, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 266, dst: 236, dx: -gridShiftXValue, dy: gridShiftYValue },
    { src: 264, dst: 234, dx: -gridShiftXValue, dy: gridShiftYValue },
  ]);

  // 요청한 타겟들: 왼쪽 위에서 복사, 텍스트만 왼쪽 위로 gridShiftValue px 이동
  // 단일 호출로 동일 패턴 적용
  [
    389, 390,
    420, 421, 422,
    451, 452, 453, 454,
    482, 483, 484, 485, 486,
    513, 514, 515, 516, 517, 518
  ].forEach(n => copyFromTopLeftShift(n));

  // 요청한 타겟들: 오른쪽 위에서 복사, 텍스트만 오른쪽 위로 gridShiftValue px 이동
  [
    356,
    386, 387,
    416, 417, 418,
    446, 447, 448, 449,
    476, 477, 478, 479, 480,
    506, 507, 508, 509, 510, 511
  ].forEach(n => copyFromTopRightShift(n));

  // Word 모드 종료: scale 변환 복원
  if (textMode === 'word') {
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateControlBarWidth();
  setTimeout(updateControlBarWidth, 0);
  needsUpdate = true;
}
