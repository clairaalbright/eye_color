(function () {
  const video = document.getElementById('video');
  const captureBtn = document.getElementById('capture-btn');
  const switchCameraBtn = document.getElementById('switch-camera');
  const cameraSection = document.getElementById('camera-section');
  const previewSection = document.getElementById('preview-section');
  const previewCanvas = document.getElementById('preview-canvas');
  const retakeBtn = document.getElementById('retake-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const resultsSection = document.getElementById('results-section');
  const resultsLoading = document.getElementById('results-loading');
  const resultsContent = document.getElementById('results-content');
  const resultsError = document.getElementById('results-error');
  const newScanBtn = document.getElementById('new-scan-btn');

  const API_BASE = '';

  let stream = null;
  let currentFacingMode = 'user';
  let capturedDataUrl = null;

  function showSection(section) {
  cameraSection.classList.add('hidden');
  previewSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  resultsLoading.classList.add('hidden');
  resultsContent.classList.add('hidden');
  resultsError.classList.add('hidden');
  section.classList.remove('hidden');
  }

  function getConstraints() {
  return {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };
  }

  async function startCamera() {
  try {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    stream = await navigator.mediaDevices.getUserMedia(getConstraints());
    video.srcObject = stream;
    captureBtn.disabled = false;
    captureBtn.focus();
    return true;
  } catch (err) {
    console.error(err);
    alert('Could not access camera. Please allow camera permission and try again.');
    captureBtn.disabled = true;
    return false;
  }
  }

  function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
  }

  function runAnalysis() {
  if (!capturedDataUrl) return;
  showSection(resultsSection);
  resultsLoading.classList.remove('hidden');
  resultsContent.classList.add('hidden');
  resultsError.classList.add('hidden');

  fetch(API_BASE + '/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: capturedDataUrl })
  })
    .then(function (res) { return res.json().then(function (data) { return { res, data }; }); })
    .then(function (_ref) {
      var res = _ref.res;
      var data = _ref.data;
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      renderResults(data);
      resultsLoading.classList.add('hidden');
      resultsContent.classList.remove('hidden');
    })
    .catch(function (err) {
      resultsLoading.classList.add('hidden');
      resultsError.textContent = err.message || 'Something went wrong. Please try again.';
      resultsError.classList.remove('hidden');
    });
  }

  captureBtn.addEventListener('click', function () {
  const ctx = previewCanvas.getContext('2d');
  const w = video.videoWidth;
  const h = video.videoHeight;
  previewCanvas.width = w;
  previewCanvas.height = h;
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
  capturedDataUrl = previewCanvas.toDataURL('image/jpeg', 0.92);
  stopCamera();
  runAnalysis();
  });

  switchCameraBtn.addEventListener('click', async function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  await startCamera();
  });

  retakeBtn.addEventListener('click', function () {
  capturedDataUrl = null;
  showSection(cameraSection);
  startCamera();
  });

  analyzeBtn.addEventListener('click', function () {
  if (!capturedDataUrl) return;
  runAnalysis();
  });

  function renderResults(data) {
  const general = data.generalColor;
  const generalSwatch = document.getElementById('general-swatch');
  const generalName = document.getElementById('general-name');
  const generalCode = document.getElementById('general-code');

  generalSwatch.style.background = general.hex;
  generalName.textContent = general.name;
  generalCode.textContent = general.colorCode || general.hex;

  var shadeList = document.getElementById('shade-breakdown-list');
  shadeList.innerHTML = '';
  (data.shadeBreakdown || []).forEach(function (item) {
    var div = document.createElement('div');
    div.className = 'shade-breakdown-item';
    div.innerHTML =
      '<div class="swatch" style="background:' + item.hex + '"></div>' +
      '<span class="shade-name">' + (item.name || item.hex) + '</span>' +
      '<span class="pct">' + item.percentage + '%</span>';
    shadeList.appendChild(div);
  });

  const breakdownList = document.getElementById('breakdown-list');
  breakdownList.innerHTML = '';
  (data.breakdown || []).forEach(function (item) {
    const div = document.createElement('div');
    div.className = 'breakdown-item';
    div.innerHTML =
      '<div class="swatch" style="background:' + item.hex + '"></div>' +
      '<span class="hex">' + (item.shadeName || item.hex) + '</span>' +
      '<span class="pct">' + item.percentage + '%</span>';
    breakdownList.appendChild(div);
  });

  const pantoneList = document.getElementById('pantone-list');
  pantoneList.innerHTML = '';
  (data.pantoneMatches || []).forEach(function (p) {
    const div = document.createElement('div');
    div.className = 'pantone-item';
    div.innerHTML =
      '<div class="swatch" style="background:' + p.hex + '"></div>' +
      '<div><span class="name">' + p.name + '</span><br><span class="hex">' + p.hex + '</span></div>';
    pantoneList.appendChild(div);
  });
  }

  newScanBtn.addEventListener('click', function () {
  capturedDataUrl = null;
  showSection(cameraSection);
  startCamera();
  });

  showSection(cameraSection);
  startCamera();
})();
