function createStableVideoPolygon(options) {
  const {
    viewer,
    m3u8Url,
    positions, // Cesium.Cartesian3[] 多边形点位
    alpha = 1,
    loop = true,
    clampToGround = false
  } = options;
  let polygonEntity = null;
  if (!viewer || !m3u8Url || !positions || positions.length < 3) {
    console.error('参数不合法');
    return null;
  }

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = loop;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.style.display = 'none';
  document.body.appendChild(video);

  loadAndBindHLSVideo(video, m3u8Url).then(() => {
    waitForVideoReady(video).then(() => {
      const cartesianPositions = convertToCartesianArray(positions);

      polygonEntity = viewer.entities.add({
        polygon: {
          hierarchy: clampToGround
            ? cartesianPositions
            : { positions: cartesianPositions },
          perPositionHeight: !clampToGround,
          material: new Cesium.ImageMaterialProperty({
            image: video,
            transparent: true,
            color: Cesium.Color.WHITE.withAlpha(alpha)
          })
        }
      });
      window.polygonEntity = polygonEntity

      console.log('[✅] 视频材质绑定成功');
    });
  }).catch(err => {
    console.error('视频流加载失败：', err);
    document.body.removeChild(video);
  });

  return {
    video,
    polygonEntity
  };
}
function destroyVideo(video, polygonEntity) {
  document.body.removeChild(video);
  viewer.entities.remove(polygonEntity);
  console.log('[❌] 视频材质销毁成功');
}

function loadAndBindHLSVideo(video, m3u8Url) {
  return new Promise((resolve, reject) => {
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      });

      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // 默认选择最高清晰度
        hls.currentLevel = hls.levels.length - 1;
        hls.autoLevelEnabled = false;

        video.play().catch(e => console.warn('自动播放失败：', e));
        resolve(hls);
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        if (data.fatal) {
          console.error('[HLS] 致命错误：', data);
          hls.destroy();
          reject(data);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8Url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.warn('Safari播放失败：', e));
        resolve();
      });
      video.addEventListener('error', () => reject(new Error('Safari播放失败')));
    } else {
      reject(new Error('该浏览器不支持 HLS'));
    }
  });
}

function waitForVideoReady(video) {
  return new Promise((resolve) => {
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function convertToCartesianArray(positions) {
  if (positions.length < 3) return [];
  if (typeof positions[0] === 'number') {
    // 假设传的是扁平经纬度数组
    return Cesium.Cartesian3.fromDegreesArray(positions);
  }
  return positions; // 已经是 Cartesian3[]
}
// 改变 polygonEntity 形状
function changePolygonEntity(polygonEntity, positions) {
  const cartesianPositions = convertToCartesianArray(positions);
  polygonEntity.polygon.hierarchy = cartesianPositions;
}

