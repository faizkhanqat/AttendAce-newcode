// preload-face-models.js
console.log('✅ Preload face-api models started');

async function preloadFaceModels() {
  if (!window.faceapi) {
    console.warn('❌ face-api not loaded yet');
    return;
  }

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models')
    ]);
    console.log('✅ Face models preloaded in background');
  } catch (err) {
    console.error('❌ Error preloading face models:', err);
  }
}

// Start preloading but don't block anything
preloadFaceModels();